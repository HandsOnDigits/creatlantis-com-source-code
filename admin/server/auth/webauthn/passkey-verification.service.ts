import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'

import { db } from '../../../src/prisma/db'
import { webauthnConfig } from './webauthn.config'

class PasskeyRegistrationRejected extends Error {}

export async function verifyPasskeyRegistration(
  adminId: string,
  sessionId: string,
  response: RegistrationResponseJSON,
): Promise<boolean> {
  const session = await db.orm.public.AdminSession.whereUnique({
    id: sessionId,
  }).first()

  if (
    !session ||
    session.adminId !== adminId ||
    session.revokedAt !== null ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    Date.parse(session.expiresAt) <= Date.now() ||
    session.webauthnChallengeType !== 'REGISTRATION' ||
    !session.webauthnChallenge ||
    !session.webauthnChallengeExpiresAt ||
    !Number.isFinite(Date.parse(session.webauthnChallengeExpiresAt)) ||
    Date.parse(session.webauthnChallengeExpiresAt) <= Date.now()
  ) {
    return false
  }

  let verification

  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: session.webauthnChallenge,
      expectedOrigin: webauthnConfig.origin,
      expectedRPID: webauthnConfig.rpID,
      requireUserVerification: true,
    })
  } catch {
    return false
  }

  if (
    !verification.verified ||
    !verification.registrationInfo ||
    !verification.registrationInfo.userVerified
  ) {
    return false
  }

  const credential = verification.registrationInfo.credential

  try {
    return await db.transaction(async (tx) => {
      const currentSession = await tx.orm.public.AdminSession.whereUnique({
        id: sessionId,
      }).first()

      if (
        !currentSession ||
        currentSession.adminId !== adminId ||
        currentSession.revokedAt !== null ||
        currentSession.expiresAt !== session.expiresAt ||
        !Number.isFinite(Date.parse(currentSession.expiresAt)) ||
        Date.parse(currentSession.expiresAt) <= Date.now() ||
        currentSession.webauthnChallenge !== session.webauthnChallenge ||
        currentSession.webauthnChallengeType !== 'REGISTRATION' ||
        currentSession.webauthnChallengeExpiresAt !==
          session.webauthnChallengeExpiresAt ||
        !currentSession.webauthnChallengeExpiresAt ||
        Date.parse(currentSession.webauthnChallengeExpiresAt) <= Date.now()
      ) {
        throw new PasskeyRegistrationRejected()
      }

      const admin = await tx.orm.public.AdminAccount.whereUnique({
        id: adminId,
      }).first()

      if (!admin || !admin.active || admin.disabledAt !== null) {
        throw new PasskeyRegistrationRejected()
      }

      const [selection, mfa, existingPasskeys] = await Promise.all([
        tx.orm.public.AdminMfaMethodSelection.whereUnique({
          adminId,
        }).first(),

        tx.orm.public.AdminMfa.whereUnique({
          adminId,
        }).first(),

        tx.orm.public.AdminPasskey.where({
          adminId,
        }).all(),
      ])

      if (selection?.method !== 'PASSKEY' || mfa !== null) {
        throw new PasskeyRegistrationRejected()
      }

      if (
        existingPasskeys.length > 0 &&
        currentSession.mfaVerifiedAt === null
      ) {
        throw new PasskeyRegistrationRejected()
      }

      const now = new Date().toISOString()

      const updatedSession = await tx.orm.public.AdminSession.where({
        id: sessionId,
        adminId,
        revokedAt: null,
        expiresAt: session.expiresAt,
        mfaVerifiedAt: currentSession.mfaVerifiedAt,
        webauthnChallenge: session.webauthnChallenge,
        webauthnChallengeType: 'REGISTRATION',
        webauthnChallengeExpiresAt: session.webauthnChallengeExpiresAt,
      }).update({
        webauthnChallenge: null,
        webauthnChallengeType: null,
        webauthnChallengeExpiresAt: null,
        mfaVerifiedAt: currentSession.mfaVerifiedAt ?? now,
        lastSeenAt: now,
      })

      if (!updatedSession) {
        throw new PasskeyRegistrationRejected()
      }

      await tx.orm.public.AdminPasskey.create({
        adminId,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        signCount: BigInt(credential.counter),
        transports: credential.transports ?? [],
      })

      return true
    })
  } catch (error) {
    if (error instanceof PasskeyRegistrationRejected) {
      return false
    }

    throw error
  }
}
