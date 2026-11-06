import argon2 from 'argon2'

import { db } from '../../../src/prisma/db'
import { createAdminSession } from './admin-session'

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
    // An invalid or corrupted stored hash must not authenticate.
    passwordValid = false
  }

  if (!passwordValid) {
    return { success: false }
  }

  const mfa = await db.orm.public.AdminMfa.whereUnique({
    adminId: admin.id,
  }).first()

  const mfaEnabled = Boolean(
    mfa?.enabledAt &&
    mfa.secretCiphertext &&
    mfa.secretNonce &&
    mfa.secretAuthTag &&
    mfa.encryptionKeyVersion !== null,
  )

  const { token } = await createAdminSession(admin.id)

  return {
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    nextStep: mfaEnabled
      ? 'MFA_VERIFICATION_REQUIRED'
      : 'MFA_ENROLLMENT_REQUIRED',
  }
}
