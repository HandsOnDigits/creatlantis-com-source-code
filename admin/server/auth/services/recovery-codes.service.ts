import { createHash, randomBytes } from 'node:crypto'

import { db } from '../../../src/prisma/db'
import { recordAdminAuditEventInTransaction } from '../../audit/audit.service'

const RECOVERY_CODE_COUNT = 10

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

export async function generateRecoveryCodesInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  adminId: string,
): Promise<string[]> {
  const [selection, mfa, passkey] = await Promise.all([
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
    selection?.method !== 'TOTP' ||
    passkey !== null ||
    !mfa ||
    mfa.enabledAt === null ||
    mfa.secretCiphertext === null ||
    mfa.secretNonce === null ||
    mfa.secretAuthTag === null ||
    mfa.encryptionKeyVersion === null
  ) {
    throw new Error('An enabled TOTP method is required.')
  }

  const existingCode = await tx.orm.public.AdminRecoveryCode.where({
    adminId,
  }).first()

  if (existingCode || mfa.recoveryCodesGeneratedAt !== null) {
    throw new Error('Recovery codes have already been generated.')
  }

  const now = new Date().toISOString()

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

  await recordAdminAuditEventInTransaction(tx, {
    adminId,
    event: 'ADMIN_RECOVERY_CODES_GENERATED',
    targetType: 'ADMIN_ACCOUNT',
    targetId: adminId,
  })

  return codes
}

export async function generateRecoveryCodes(
  adminId: string,
): Promise<string[]> {
  return db.transaction((tx) => generateRecoveryCodesInTransaction(tx, adminId))
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
      const [selection, mfa, passkey] = await Promise.all([
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
        selection?.method !== 'TOTP' ||
        passkey !== null ||
        !mfa?.enabledAt ||
        !mfa.secretCiphertext ||
        !mfa.secretNonce ||
        !mfa.secretAuthTag ||
        mfa.recoveryCodesGeneratedAt === null
      ) {
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

      const expiration = session ? Date.parse(session.expiresAt) : Number.NaN

      if (
        !session ||
        session.adminId !== adminId ||
        session.revokedAt !== null ||
        !Number.isFinite(expiration) ||
        expiration <= Date.now() ||
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
        expiresAt: session.expiresAt,
        mfaVerifiedAt: session.mfaVerifiedAt,
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

export async function replaceRecoveryCodes(adminId: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [selection, mfa, passkey] = await Promise.all([
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
      selection?.method !== 'TOTP' ||
      passkey !== null ||
      !mfa?.enabledAt ||
      !mfa.secretCiphertext ||
      !mfa.secretNonce ||
      !mfa.secretAuthTag ||
      mfa.recoveryCodesGeneratedAt === null
    ) {
      throw new Error('An enabled TOTP method is required.')
    }

    const previousTimestamp = mfa.recoveryCodesGeneratedAt

    const nextTimestamp = new Date(
      Math.max(
        Date.now(),
        previousTimestamp === null ? 0 : Date.parse(previousTimestamp) + 1,
      ),
    ).toISOString()

    const claimed = await tx.orm.public.AdminMfa.where({
      adminId,
      enabledAt: mfa.enabledAt,
      recoveryCodesGeneratedAt: previousTimestamp,
    }).update({
      recoveryCodesGeneratedAt: nextTimestamp,
    })

    if (!claimed) {
      throw new Error('Recovery codes changed. Please try again.')
    }

    const existingCodes = await tx.orm.public.AdminRecoveryCode.where({
      adminId,
    }).all()

    for (const existingCode of existingCodes) {
      await tx.orm.public.AdminRecoveryCode.whereUnique({
        id: existingCode.id,
      }).delete()
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
