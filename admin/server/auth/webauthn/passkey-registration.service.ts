import { generateRegistrationOptions } from '@simplewebauthn/server'

import { db } from '../../../src/prisma/db'
import { webauthnConfig } from './webauthn.config'
import { storeWebAuthnChallenge } from './webauthn-challenge.service'

export async function createPasskeyRegistrationOptions(
  adminId: string,
  sessionId: string,
) {
  const admin = await db.orm.public.AdminAccount.whereUnique({
    id: adminId,
  }).first()

  if (!admin || !admin.active || admin.disabledAt !== null) {
    throw new Error('Administrator account is unavailable.')
  }

  const [selection, existingMfa, existingPasskeys] = await Promise.all([
    db.orm.public.AdminMfaMethodSelection.whereUnique({ adminId }).first(),
    db.orm.public.AdminMfa.whereUnique({ adminId }).first(),
    db.orm.public.AdminPasskey.where({ adminId }).all(),
  ])

  if (selection !== null && selection.method !== 'PASSKEY') {
    throw new Error(
      'TOTP has already been selected. Passkey enrollment is unavailable.',
    )
  }

  if (existingMfa !== null) {
    throw new Error(
      'A TOTP configuration already exists. Passkey enrollment is unavailable.',
    )
  }

  // Reserve PASSKEY. The unique adminId constraint prevents another
  // MFA method from being selected concurrently.
  if (selection === null) {
    try {
      await db.orm.public.AdminMfaMethodSelection.create({
        adminId,
        method: 'PASSKEY',
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

      if (currentSelection.method !== 'PASSKEY') {
        throw new Error(
          'TOTP has already been selected. Passkey enrollment is unavailable.',
        )
      }
    }
  }

  const options = await generateRegistrationOptions({
    rpName: webauthnConfig.rpName,
    rpID: webauthnConfig.rpID,
    userName: admin.email,
    userID: new TextEncoder().encode(admin.id),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
    })),
  })

  const stored = await storeWebAuthnChallenge(
    adminId,
    sessionId,
    options.challenge,
    'REGISTRATION',
  )

  if (!stored) {
    throw new Error('Unable to create a passkey registration challenge.')
  }

  return options
}
