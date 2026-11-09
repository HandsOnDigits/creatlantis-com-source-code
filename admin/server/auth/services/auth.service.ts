import argon2 from 'argon2'

import { db } from '../../../src/prisma/db'
import { createAdminSession } from './admin-session'

export type AdminMfaMethod = 'TOTP' | 'PASSKEY'

export type AdminLoginResult =
  | {
      success: true
      token: string
      admin: {
        id: string
        email: string
        role: string
      }
      nextStep: 'MFA_ENROLLMENT_REQUIRED' | 'MFA_VERIFICATION_REQUIRED'
      availableMethods: AdminMfaMethod[]
    }
  | {
      success: false
    }

export async function authenticateAdminPassword(
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  const normalizedEmail = email.trim().toLowerCase()

  const admin = await db.orm.public.AdminAccount.where({
    email: normalizedEmail,
  }).first()

  if (!admin || !admin.active || admin.disabledAt !== null) {
    return { success: false }
  }

  let passwordValid = false

  try {
    passwordValid = await argon2.verify(admin.passwordHash, password)
  } catch {
    passwordValid = false
  }

  if (!passwordValid) {
    return { success: false }
  }

  const [selection, mfa, passkeys] = await Promise.all([
    db.orm.public.AdminMfaMethodSelection.whereUnique({
      adminId: admin.id,
    }).first(),

    db.orm.public.AdminMfa.whereUnique({
      adminId: admin.id,
    }).first(),

    db.orm.public.AdminPasskey.where({
      adminId: admin.id,
    }).all(),
  ])

  // Existing MFA configuration without a selection indicates
  // inconsistent state. Do not allow login to continue.
  if (!selection && (mfa !== null || passkeys.length > 0)) {
    return { success: false }
  }

  let availableMethods: AdminMfaMethod[] = []
  let nextStep: 'MFA_ENROLLMENT_REQUIRED' | 'MFA_VERIFICATION_REQUIRED' =
    'MFA_ENROLLMENT_REQUIRED'

  if (selection?.method === 'TOTP') {
    // A TOTP selection must never coexist with passkeys.
    if (passkeys.length > 0) {
      return { success: false }
    }

    availableMethods = ['TOTP']

    const totpEnabled = Boolean(
      mfa?.enabledAt &&
      mfa.secretCiphertext &&
      mfa.secretNonce &&
      mfa.secretAuthTag &&
      mfa.encryptionKeyVersion !== null,
    )

    if (totpEnabled) {
      nextStep = 'MFA_VERIFICATION_REQUIRED'
    }
  } else if (selection?.method === 'PASSKEY') {
    // A passkey selection must never coexist with TOTP configuration.
    if (mfa !== null) {
      return { success: false }
    }

    availableMethods = ['PASSKEY']

    if (passkeys.length > 0) {
      nextStep = 'MFA_VERIFICATION_REQUIRED'
    }
  }

  await db.orm.public.AdminAccount.whereUnique({
    id: admin.id,
  }).update({
    lastLoginAt: new Date().toISOString(),
  })

  const { token } = await createAdminSession(admin.id)

  return {
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    nextStep,
    availableMethods,
  }
}
