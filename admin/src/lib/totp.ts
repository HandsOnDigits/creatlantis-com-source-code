const API_BASE_URL = 'http://localhost:3001/api'

export interface TotpEnrollment {
  qrCodeDataUrl: string
  secret: string
}

export interface TotpEnrollmentConfirmation {
  success: true
  mfaEnabled: true
  recoveryCodes: string[]
}

export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const response = await fetch(`${API_BASE_URL}/mfa/enrollment`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to start TOTP enrollment.')
  }

  return data as TotpEnrollment
}

export async function confirmTotpEnrollment(
  token: string,
): Promise<TotpEnrollmentConfirmation> {
  const response = await fetch(`${API_BASE_URL}/mfa/enrollment/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ token }),
  })

  const data = await response.json()

  if (!response.ok || !data.success || !Array.isArray(data.recoveryCodes)) {
    throw new Error(data.error ?? 'TOTP enrollment failed.')
  }

  return data as TotpEnrollmentConfirmation
}

export async function verifyRecoveryCode(code: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/mfa/recovery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ code }),
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? 'Recovery code verification failed.')
  }
}
