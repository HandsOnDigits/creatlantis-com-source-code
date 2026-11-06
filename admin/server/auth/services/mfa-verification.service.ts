import { db } from '../../../src/prisma/db'

import { decryptMfaSecret } from './mfa-crypto'
import { verifyTotpCode } from './mfa-totp'

class MfaVerificationRejected extends Error {}

export async function verifyAdminMfa(
  adminId: string,
  sessionId: string,
  token: string,
): Promise<boolean> {
  const mfa = await db.orm.public.AdminMfa.whereUnique({ adminId }).first()

  if (
    !mfa ||
    mfa.enabledAt === null ||
    !mfa.secretCiphertext ||
    !mfa.secretNonce ||
    !mfa.secretAuthTag ||
    mfa.encryptionKeyVersion === null
  ) {
    return false
  }

  const secret = decryptMfaSecret(
    mfa.secretCiphertext,
    mfa.secretNonce,
    mfa.secretAuthTag,
    mfa.encryptionKeyVersion,
  )

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
      const now = new Date().toISOString()

      const session = await tx.orm.public.AdminSession.whereUnique({
        id: sessionId,
      }).first()

      if (
        !session ||
        session.adminId !== adminId ||
        session.revokedAt !== null ||
        Date.parse(session.expiresAt) <= Date.now()
      ) {
        throw new MfaVerificationRejected()
      }

      const admin = await tx.orm.public.AdminAccount.whereUnique({
        id: adminId,
      }).first()

      if (!admin || !admin.active || admin.disabledAt !== null) {
        throw new MfaVerificationRejected()
      }

      // Consume this TOTP time step exactly once.
      const mfaUpdated = await tx.orm.public.AdminMfa.where({
        adminId,
        enabledAt: mfa.enabledAt,
        lastAcceptedTimeStep: mfa.lastAcceptedTimeStep,
      }).update({
        lastAcceptedTimeStep: BigInt(acceptedTimeStep),
      })

      if (!mfaUpdated) {
        throw new MfaVerificationRejected()
      }

      // Mark the session as verified in the same transaction.
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
