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

  await db.orm.public.AdminAccount.whereUnique({
    id: admin.id,
  }).update({
    lastLoginAt: new Date().toISOString(),
  })

  const [mfa, passkeys] = await Promise.all([
    db.orm.public.AdminMfa.whereUnique({
      adminId: admin.id,
    }).first(),

    db.orm.public.AdminPasskey.where({
      adminId: admin.id,
    }).all(),
  ])

  const totpEnabled = Boolean(
    mfa?.enabledAt &&
    mfa.secretCiphertext &&
    mfa.secretNonce &&
    mfa.secretAuthTag &&
    mfa.encryptionKeyVersion !== null,
  )

  const availableMethods: AdminMfaMethod[] = []

  if (totpEnabled) {
    availableMethods.push('TOTP')
  }

  if (passkeys.length > 0) {
    availableMethods.push('PASSKEY')
  }

  const { token } = await createAdminSession(admin.id)

  return {
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    nextStep:
      availableMethods.length > 0
        ? 'MFA_VERIFICATION_REQUIRED'
        : 'MFA_ENROLLMENT_REQUIRED',
    availableMethods,
  }
}
