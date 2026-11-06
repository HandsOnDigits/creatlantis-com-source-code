import { db } from '../../../src/prisma/db'

import { encryptMfaSecret } from './mfa-crypto'
import { createTotpEnrollment } from './mfa-totp'

export async function startMfaEnrollment(adminId: string, email: string) {
  const existing = await db.orm.public.AdminMfa.whereUnique({ adminId }).first()

  // An enabled MFA configuration must never be replaced
  // through the ordinary enrollment flow.
  if (existing?.enabledAt !== null && existing?.enabledAt !== undefined) {
    throw new Error('MFA is already enabled.')
  }

  const enrollment = await createTotpEnrollment(email)
  const encrypted = encryptMfaSecret(enrollment.secret)

  const data = {
    secretCiphertext: encrypted.ciphertext,
    secretNonce: encrypted.nonce,
    secretAuthTag: encrypted.authTag,
    encryptionKeyVersion: encrypted.encryptionKeyVersion,
    enabledAt: null,
    lastAcceptedTimeStep: null,
  }

  if (existing) {
    await db.orm.public.AdminMfa.whereUnique({ adminId }).update(data)
  } else {
    await db.orm.public.AdminMfa.create({
      adminId,
      ...data,
    })
  }

  return {
    qrCodeDataUrl: enrollment.qrCodeDataUrl,
    secret: enrollment.secret,
  }
}
