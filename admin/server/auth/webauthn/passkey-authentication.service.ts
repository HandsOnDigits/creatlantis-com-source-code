import type { AuthenticatorTransport } from '@simplewebauthn/server'

import { generateAuthenticationOptions } from '@simplewebauthn/server'

import { db } from '../../../src/prisma/db'
import { webauthnConfig } from './webauthn.config'
import { storeWebAuthnChallenge } from './webauthn-challenge.service'

export async function createPasskeyAuthenticationOptions(
  adminId: string,
  sessionId: string,
) {
  const [admin, selection, mfa, passkeys] = await Promise.all([
    db.orm.public.AdminAccount.whereUnique({
      id: adminId,
    }).first(),

    db.orm.public.AdminMfaMethodSelection.whereUnique({
      adminId,
    }).first(),

    db.orm.public.AdminMfa.whereUnique({
      adminId,
    }).first(),

    db.orm.public.AdminPasskey.where({
      adminId,
    }).all(),
  ])

  if (!admin || !admin.active || admin.disabledAt !== null) {
    throw new Error('Administrator account is unavailable.')
  }

  if (selection?.method !== 'PASSKEY') {
    throw new Error('Passkey is not the selected MFA method.')
  }

  if (mfa !== null) {
    throw new Error('Conflicting MFA configuration.')
  }

  if (passkeys.length === 0) {
    throw new Error('No passkeys are registered for this administrator.')
  }

  const options = await generateAuthenticationOptions({
    rpID: webauthnConfig.rpID,
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports as AuthenticatorTransport[],
    })),
    userVerification: 'required',
  })

  const stored = await storeWebAuthnChallenge(
    adminId,
    sessionId,
    options.challenge,
    'AUTHENTICATION',
  )

  if (!stored) {
    throw new Error('Unable to create a passkey authentication challenge.')
  }

  return options
}
