import { createHash, randomBytes } from 'node:crypto'

import { verifyAdminSessionMfa } from './admin-session'

import { db } from '../../../src/prisma/db'

const RECOVERY_CODE_COUNT = 10

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

export async function generateRecoveryCodes(
  adminId: string,
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const mfa = await tx.orm.public.AdminMfa.whereUnique({ adminId }).first()

    if (!mfa?.enabledAt) {
      throw new Error('MFA must be enabled before generating recovery codes.')
    }

    // Also detect codes created before the generation guard existed.
    const existingCode = await tx.orm.public.AdminRecoveryCode.where({
      adminId,
    }).first()

    if (existingCode || mfa.recoveryCodesGeneratedAt !== null) {
      throw new Error('Recovery codes have already been generated.')
    }

    const now = new Date().toISOString()

    // Only one concurrent request can claim generation.
    const claimed = await tx.orm.public.AdminMfa.where({
      adminId,
      enabledAt: mfa.enabledAt,
      recoveryCodesGeneratedAt: null,
    }).update({
      recoveryCodesGeneratedAt: now,
    })

    if (!claimed) {
      throw new Error('Recovery codes have already been generated.')
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomBytes(16).toString('base64url'),
    )

    for (const code of codes) {
      await tx.orm.public.AdminRecoveryCode.create({
        adminId,
        codeHash: hashRecoveryCode(code),
      })
    }

    return codes
  })
}

class RecoveryCodeRejected extends Error {}

export async function verifyRecoveryCode(
  adminId: string,
  sessionId: string,
  code: string,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) {
    return false
  }

  const codeHash = hashRecoveryCode(code)

  try {
    return await db.transaction(async (tx) => {
      const mfa = await tx.orm.public.AdminMfa.whereUnique({ adminId }).first()

      if (!mfa?.enabledAt) {
        throw new RecoveryCodeRejected()
      }

      const recoveryCode = await tx.orm.public.AdminRecoveryCode.whereUnique({
        codeHash,
      }).first()

      if (
        !recoveryCode ||
        recoveryCode.adminId !== adminId ||
        recoveryCode.usedAt !== null
      ) {
        throw new RecoveryCodeRejected()
      }

      const session = await tx.orm.public.AdminSession.whereUnique({
        id: sessionId,
      }).first()

      const admin = await tx.orm.public.AdminAccount.whereUnique({
        id: adminId,
      }).first()

      if (
        !session ||
        session.adminId !== adminId ||
        session.revokedAt !== null ||
        Date.parse(session.expiresAt) <= Date.now() ||
        !admin ||
        !admin.active ||
        admin.disabledAt !== null
      ) {
        throw new RecoveryCodeRejected()
      }

      const now = new Date().toISOString()

      const consumed = await tx.orm.public.AdminRecoveryCode.where({
        id: recoveryCode.id,
        adminId,
        usedAt: null,
      }).update({
        usedAt: now,
      })

      if (!consumed) {
        throw new RecoveryCodeRejected()
      }

      const verified = await tx.orm.public.AdminSession.where({
        id: sessionId,
        adminId,
        revokedAt: null,
      }).update({
        mfaVerifiedAt: now,
        lastSeenAt: now,
      })

      if (!verified) {
        throw new RecoveryCodeRejected()
      }

      return true
    })
  } catch (error) {
    if (error instanceof RecoveryCodeRejected) {
      return false
    }

    throw error
  }
}
