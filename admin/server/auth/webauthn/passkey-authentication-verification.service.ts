import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import type { AuthenticatorTransport } from '@simplewebauthn/server'

import { db } from '../../../src/prisma/db'
import { webauthnConfig } from './webauthn.config'

class PasskeyAuthenticationRejected extends Error {}

export async function verifyPasskeyAuthentication(
  adminId: string,
  sessionId: string,
  response: AuthenticationResponseJSON,
): Promise<boolean> {
  const session = await db.orm.public.AdminSession.whereUnique({
    id: sessionId,
  }).first()

  if (
    !session ||
    session.adminId !== adminId ||
    session.revokedAt !== null ||
    Date.parse(session.expiresAt) <= Date.now() ||
    session.webauthnChallengeType !== 'AUTHENTICATION' ||
    !session.webauthnChallenge ||
    !session.webauthnChallengeExpiresAt ||
    Date.parse(session.webauthnChallengeExpiresAt) <= Date.now()
  ) {
    return false
  }

  const passkey = await db.orm.public.AdminPasskey.whereUnique({
    credentialId: response.id,
  }).first()

  if (!passkey || passkey.adminId !== adminId) {
    return false
  }

  const storedCounter = Number(passkey.signCount)

  if (!Number.isSafeInteger(storedCounter) || storedCounter < 0) {
    return false
  }

  let verification

  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: session.webauthnChallenge,
      expectedOrigin: webauthnConfig.origin,
      expectedRPID: webauthnConfig.rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: storedCounter,
        transports: passkey.transports as AuthenticatorTransport[],
      },
      requireUserVerification: true,
    })
  } catch {
    return false
  }

  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    return false
  }

  try {
    return await db.transaction(async (tx) => {
      const now = new Date().toISOString()

      const currentSession = await tx.orm.public.AdminSession.whereUnique({
        id: sessionId,
      }).first()

      if (
        !currentSession ||
        currentSession.adminId !== adminId ||
        currentSession.revokedAt !== null ||
        Date.parse(currentSession.expiresAt) <= Date.now() ||
        currentSession.webauthnChallenge !== session.webauthnChallenge ||
        currentSession.webauthnChallengeType !== 'AUTHENTICATION' ||
        currentSession.webauthnChallengeExpiresAt !==
          session.webauthnChallengeExpiresAt
      ) {
        throw new PasskeyAuthenticationRejected()
      }

      const admin = await tx.orm.public.AdminAccount.whereUnique({
        id: adminId,
      }).first()

      if (!admin || !admin.active || admin.disabledAt !== null) {
        throw new PasskeyAuthenticationRejected()
      }

      const updatedSession = await tx.orm.public.AdminSession.where({
        id: sessionId,
        adminId,
        revokedAt: null,
        webauthnChallenge: session.webauthnChallenge,
        webauthnChallengeType: 'AUTHENTICATION',
        webauthnChallengeExpiresAt: session.webauthnChallengeExpiresAt,
      }).update({
        webauthnChallenge: null,
        webauthnChallengeType: null,
        webauthnChallengeExpiresAt: null,
        mfaVerifiedAt: now,
        lastSeenAt: now,
      })

      if (!updatedSession) {
        throw new PasskeyAuthenticationRejected()
      }

      const updatedPasskey = await tx.orm.public.AdminPasskey.where({
        id: passkey.id,
        adminId,
        signCount: passkey.signCount,
      }).update({
        signCount: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: now,
      })

      if (!updatedPasskey) {
        throw new PasskeyAuthenticationRejected()
      }

      return true
    })
  } catch (error) {
    if (error instanceof PasskeyAuthenticationRejected) {
      return false
    }

    throw error
  }
}
