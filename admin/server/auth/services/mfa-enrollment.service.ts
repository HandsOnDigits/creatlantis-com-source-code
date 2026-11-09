import { db } from '../../../src/prisma/db'

import { encryptMfaSecret } from './mfa-crypto'
import { createTotpEnrollment } from './mfa-totp'

export async function startMfaEnrollment(adminId: string, email: string) {
  const [selection, existing, passkeys] = await Promise.all([
    db.orm.public.AdminMfaMethodSelection.whereUnique({ adminId }).first(),
    db.orm.public.AdminMfa.whereUnique({ adminId }).first(),
    db.orm.public.AdminPasskey.where({ adminId }).all(),
  ])

  if (selection !== null && selection.method !== 'TOTP') {
    throw new Error(
      'Passkey has already been selected. TOTP enrollment is unavailable.',
    )
  }

  if (passkeys.length > 0) {
    throw new Error(
      'A passkey is already registered. TOTP enrollment is unavailable.',
    )
  }

  if (existing?.enabledAt != null) {
    throw new Error('MFA is already enabled.')
  }

  // Reserve TOTP. The unique adminId constraint prevents another
  // MFA method from being selected concurrently.
  if (selection === null) {
    try {
      await db.orm.public.AdminMfaMethodSelection.create({
        adminId,
        method: 'TOTP',
      })
    } catch (error) {
      // Another request may have reserved a method concurrently.
      const currentSelection =
        await db.orm.public.AdminMfaMethodSelection.whereUnique({
          adminId,
        }).first()

      if (currentSelection === null) {
        throw error
      }

      if (currentSelection.method !== 'TOTP') {
        throw new Error(
          'Passkey has already been selected. TOTP enrollment is unavailable.',
        )
      }
    }
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

  await db.transaction(async (tx) => {
    const [currentSelection, currentMfa, currentPasskeys] = await Promise.all([
      tx.orm.public.AdminMfaMethodSelection.whereUnique({
        adminId,
      }).first(),

      tx.orm.public.AdminMfa.whereUnique({
        adminId,
      }).first(),

      tx.orm.public.AdminPasskey.where({
        adminId,
      }).all(),
    ])

    if (currentSelection?.method !== 'TOTP') {
      throw new Error('TOTP is not the selected MFA method.')
    }

    if (currentPasskeys.length > 0) {
      throw new Error('Passkey registration prevents TOTP enrollment.')
    }

    if (currentMfa?.enabledAt != null) {
      throw new Error('MFA is already enabled.')
    }

    if (currentMfa) {
      await tx.orm.public.AdminMfa.whereUnique({
        adminId,
      }).update(data)
    } else {
      await tx.orm.public.AdminMfa.create({
        adminId,
        ...data,
      })
    }
  })

  return {
    qrCodeDataUrl: enrollment.qrCodeDataUrl,
    secret: enrollment.secret,
  }
}
