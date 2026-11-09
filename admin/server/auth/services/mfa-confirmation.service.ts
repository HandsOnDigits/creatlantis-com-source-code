import { db } from '../../../src/prisma/db'

import { decryptMfaSecret } from './mfa-crypto'
import { verifyTotpCode } from './mfa-totp'

import { generateRecoveryCodesInTransaction } from './recovery-codes.service'

class MfaEnrollmentRejected extends Error {}

export async function confirmMfaEnrollment(
  adminId: string,
  sessionId: string,
  token: string,
): Promise<string[] | null> {
  const [mfa, selection] = await Promise.all([
    db.orm.public.AdminMfa.whereUnique({ adminId }).first(),
    db.orm.public.AdminMfaMethodSelection.whereUnique({ adminId }).first(),
  ])

  if (
    !mfa ||
    !selection ||
    selection.method !== 'TOTP' ||
    mfa.enabledAt !== null ||
    mfa.secretCiphertext === null ||
    mfa.secretNonce === null ||
    mfa.secretAuthTag === null ||
    mfa.encryptionKeyVersion === null
  ) {
    return null
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
    return null
  }

  const verification = await verifyTotpCode(
    secret,
    token,
    mfa.lastAcceptedTimeStep,
  )

  if (!verification.valid || verification.timeStep === null) {
    return null
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
        !Number.isFinite(Date.parse(session.expiresAt)) ||
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

      const currentSelection =
        await tx.orm.public.AdminMfaMethodSelection.whereUnique({
          adminId,
        }).first()

      if (currentSelection?.method !== 'TOTP') {
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
        secretCiphertext: mfa.secretCiphertext,
        secretNonce: mfa.secretNonce,
        secretAuthTag: mfa.secretAuthTag,
        encryptionKeyVersion: mfa.encryptionKeyVersion,
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

      return generateRecoveryCodesInTransaction(tx, adminId)
    })
  } catch (error) {
    if (error instanceof MfaEnrollmentRejected) {
      return null
    }

    throw error
  }
}
