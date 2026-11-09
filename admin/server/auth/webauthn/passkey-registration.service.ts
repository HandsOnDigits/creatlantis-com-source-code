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

  const existingPasskeys = await db.orm.public.AdminPasskey.where({
    adminId,
  }).all()

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
