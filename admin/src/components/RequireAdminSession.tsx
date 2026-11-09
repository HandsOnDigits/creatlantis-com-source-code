import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { getAdminSession } from '../lib/admin-session'

type SessionStatus = 'loading' | 'authorized' | 'unauthorized'

export default function RequireAdminSession() {
  const [status, setStatus] = useState<SessionStatus>('loading')

  useEffect(() => {
    let active = true

    async function verifySession() {
      try {
        const session = await getAdminSession()

        if (active) {
          setStatus(
            session.mfaVerified && session.nextStep === 'AUTHENTICATED'
              ? 'authorized'
              : 'unauthorized',
          )
        }
      } catch {
        if (active) {
          setStatus('unauthorized')
        }
      }
    }

    void verifySession()

    return () => {
      active = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <main className="bg-admin-bg flex min-h-screen items-center justify-center text-white">
        <p className="text-admin-muted text-sm">
          Verifying administrator session...
        </p>
      </main>
    )
  }

  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
