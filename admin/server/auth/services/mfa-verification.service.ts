import { db } from '../../../src/prisma/db'

import { decryptMfaSecret } from './mfa-crypto'
import { verifyTotpCode } from './mfa-totp'

class MfaVerificationRejected extends Error {}

export async function verifyAdminMfa(
  adminId: string,
  sessionId: string,
  token: string,
): Promise<boolean> {
  const [selection, mfa, passkey] = await Promise.all([
    db.orm.public.AdminMfaMethodSelection.whereUnique({
      adminId,
    }).first(),

    db.orm.public.AdminMfa.whereUnique({
      adminId,
    }).first(),

    db.orm.public.AdminPasskey.where({
      adminId,
    }).first(),
  ])

  if (
    selection?.method !== 'TOTP' ||
    passkey !== null ||
    !mfa ||
    mfa.enabledAt === null ||
    mfa.secretCiphertext === null ||
    mfa.secretNonce === null ||
    mfa.secretAuthTag === null ||
    mfa.encryptionKeyVersion === null
  ) {
    return false
  }

  let secret: string

  try {
    secret = decryptMfaSecret(
      mfa.secretCiphertext,
      mfa.secretNonce,
      mfa.secretAuthTag,
      mfa.encryptionKeyVersion,
    )
  } catch {
    return false
  }

  const verification = await verifyTotpCode(
    secret,
    token,
    mfa.lastAcceptedTimeStep,
  )

  if (!verification.valid || verification.timeStep === null) {
    return false
  }

  const acceptedTimeStep = verification.timeStep

  try {
    return await db.transaction(async (tx) => {
      const session = await tx.orm.public.AdminSession.whereUnique({
        id: sessionId,
      }).first()

      if (
        !session ||
        session.adminId !== adminId ||
        session.revokedAt !== null ||
        !Number.isFinite(Date.parse(session.expiresAt)) ||
        Date.parse(session.expiresAt) <= Date.now()
      ) {
        throw new MfaVerificationRejected()
      }

      const [admin, currentSelection, currentMfa, currentPasskey] =
        await Promise.all([
          tx.orm.public.AdminAccount.whereUnique({
            id: adminId,
          }).first(),

          tx.orm.public.AdminMfaMethodSelection.whereUnique({
            adminId,
          }).first(),

          tx.orm.public.AdminMfa.whereUnique({
            adminId,
          }).first(),

          tx.orm.public.AdminPasskey.where({
            adminId,
          }).first(),
        ])

      if (
        !admin ||
        !admin.active ||
        admin.disabledAt !== null ||
        currentSelection?.method !== 'TOTP' ||
        currentPasskey !== null ||
        !currentMfa ||
        currentMfa.enabledAt !== mfa.enabledAt ||
        currentMfa.encryptionKeyVersion !== mfa.encryptionKeyVersion ||
        currentMfa.lastAcceptedTimeStep !== mfa.lastAcceptedTimeStep ||
        currentMfa.secretCiphertext !== mfa.secretCiphertext ||
        currentMfa.secretNonce !== mfa.secretNonce ||
        currentMfa.secretAuthTag !== mfa.secretAuthTag
      ) {
        throw new MfaVerificationRejected()
      }

      // Consume this TOTP time step exactly once.
      const mfaUpdated = await tx.orm.public.AdminMfa.where({
        adminId,
        enabledAt: mfa.enabledAt,
        lastAcceptedTimeStep: mfa.lastAcceptedTimeStep,
        secretCiphertext: mfa.secretCiphertext,
        secretNonce: mfa.secretNonce,
        secretAuthTag: mfa.secretAuthTag,
        encryptionKeyVersion: mfa.encryptionKeyVersion,
      }).update({
        lastAcceptedTimeStep: BigInt(acceptedTimeStep),
      })

      if (!mfaUpdated) {
        throw new MfaVerificationRejected()
      }

      // Mark the session as verified in the same transaction.
      const now = new Date().toISOString()

      const sessionUpdated = await tx.orm.public.AdminSession.where({
        id: sessionId,
        adminId,
        revokedAt: null,
        expiresAt: session.expiresAt,
        mfaVerifiedAt: session.mfaVerifiedAt,
      }).update({
        mfaVerifiedAt: now,
        lastSeenAt: now,
      })

      if (!sessionUpdated) {
        throw new MfaVerificationRejected()
      }

      return true
    })
  } catch (error) {
    if (error instanceof MfaVerificationRejected) {
      return false
    }

    throw error
  }
}
