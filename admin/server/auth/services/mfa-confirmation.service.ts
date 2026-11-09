import { db } from '../../../src/prisma/db'

import { decryptMfaSecret } from './mfa-crypto'
import { verifyTotpCode } from './mfa-totp'

class MfaEnrollmentRejected extends Error {}

export async function confirmMfaEnrollment(
  adminId: string,
  sessionId: string,
  token: string,
): Promise<boolean> {
  const mfa = await db.orm.public.AdminMfa.whereUnique({ adminId }).first()

  if (
    !mfa ||
    mfa.enabledAt !== null ||
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
        throw new MfaEnrollmentRejected()
      }

      const admin = await tx.orm.public.AdminAccount.whereUnique({
        id: adminId,
      }).first()

      if (!admin || !admin.active || admin.disabledAt !== null) {
        throw new MfaEnrollmentRejected()
      }

      const existingPasskeys = await tx.orm.public.AdminPasskey.where({
        adminId,
      }).all()

      if (existingPasskeys.length > 0) {
        throw new MfaEnrollmentRejected()
      }

      const mfaUpdated = await tx.orm.public.AdminMfa.where({
        adminId,
        enabledAt: null,
        lastAcceptedTimeStep: mfa.lastAcceptedTimeStep,
      }).update({
        enabledAt: now,
        lastAcceptedTimeStep: BigInt(acceptedTimeStep),
      })

      if (!mfaUpdated) {
        throw new MfaEnrollmentRejected()
      }

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
        throw new MfaEnrollmentRejected()
      }

      return true
    })
  } catch (error) {
    if (error instanceof MfaEnrollmentRejected) {
      return false
    }

    throw error
  }
}
