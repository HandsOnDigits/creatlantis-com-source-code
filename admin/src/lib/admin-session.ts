export interface AdminSessionResponse {
  admin: {
    id: string
    email: string
    role: string
  }
  mfaEnabled: boolean
  mfaVerified: boolean
  nextStep: string
}

export async function getAdminSession(): Promise<AdminSessionResponse> {
  const response = await fetch('http://localhost:3001/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to verify admin session.')
  }

  return data as AdminSessionResponse
}
