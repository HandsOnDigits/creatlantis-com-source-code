import {
  browserSupportsWebAuthn,
  startRegistration,
} from '@simplewebauthn/browser'

export async function registerAdminPasskey(): Promise<void> {
  if (!browserSupportsWebAuthn()) {
    throw new Error('This browser does not support passkeys.')
  }

  const optionsResponse = await fetch(
    'http://localhost:3001/api/passkeys/registration/options',
    {
      method: 'POST',
      credentials: 'include',
    },
  )

  const options = await optionsResponse.json()

  if (!optionsResponse.ok) {
    throw new Error(options.error ?? 'Unable to start passkey registration.')
  }

  const credential = await startRegistration({
    optionsJSON: options,
  })

  const verificationResponse = await fetch(
    'http://localhost:3001/api/passkeys/registration/verify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credential),
    },
  )

  const result = await verificationResponse.json()

  if (!verificationResponse.ok || !result.success) {
    throw new Error(result.error ?? 'Passkey registration failed.')
  }
}
