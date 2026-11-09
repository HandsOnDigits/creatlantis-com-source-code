import { useState, type FormEvent } from 'react'
import { authenticateAdminPasskey, registerAdminPasskey } from '../lib/passkeys'

import { useNavigate } from 'react-router-dom'
import { getAdminSession } from '../lib/admin-session'

interface LoginResponse {
  admin?: {
    id: string
    email: string
    role: string
  }
  nextStep?: string
  availableMethods?: ('TOTP' | 'PASSKEY')[]
  error?: string
  message?: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [error, setError] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [availableMethods, setAvailableMethods] = useState<
    ('TOTP' | 'PASSKEY')[]
  >([])

  const navigate = useNavigate()

  async function completeAuthentication() {
    const session = await getAdminSession()

    if (!session.mfaVerified || session.nextStep !== 'AUTHENTICATED') {
      throw new Error('Administrator MFA verification was not confirmed.')
    }

    navigate('/admin', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setNextStep('')
    setAvailableMethods([])
    setLoading(true)

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = (await response.json()) as LoginResponse

      if (!response.ok) {
        throw new Error(data.error ?? data.message ?? 'Login failed.')
      }

      setNextStep(data.nextStep ?? 'UNKNOWN')
      setAvailableMethods(data.availableMethods ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handlePasskeyRegistration() {
    setError('')
    setPasskeyLoading(true)

    try {
      await registerAdminPasskey()
      await completeAuthentication()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Passkey registration failed.',
      )
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handlePasskeyAuthentication() {
    setError('')
    setPasskeyLoading(true)

    try {
      await authenticateAdminPasskey()
      await completeAuthentication()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Passkey authentication failed.',
      )
    } finally {
      setPasskeyLoading(false)
    }
  }

  return (
    <main className="bg-admin-bg flex min-h-screen items-center justify-center px-6 py-12 text-white">
      <section className="border-admin-border bg-admin-panel w-full max-w-md rounded-2xl border p-8 shadow-2xl">
        <div className="mb-8">
          <div className="bg-admin-accent/15 text-admin-accent mb-5 flex size-12 items-center justify-center rounded-xl text-xl font-bold">
            C
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">CreAtlantis</h1>

          <p className="text-admin-muted mt-1 text-sm">Administration portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={nextStep !== ''}
              className="border-admin-border bg-admin-bg focus:border-admin-accent focus:ring-admin-accent/20 w-full rounded-lg border px-4 py-3 text-sm transition outline-none placeholder:text-gray-600 focus:ring-2 disabled:opacity-60"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={nextStep !== ''}
              className="border-admin-border bg-admin-bg focus:border-admin-accent focus:ring-admin-accent/20 w-full rounded-lg border px-4 py-3 text-sm transition outline-none placeholder:text-gray-600 focus:ring-2 disabled:opacity-60"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || passkeyLoading || nextStep !== ''}
            className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {nextStep === 'MFA_ENROLLMENT_REQUIRED' && (
          <div className="border-admin-border mt-6 space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">
              Set up multi-factor authentication
            </h2>

            <p className="text-admin-muted text-sm">
              Register a passkey using Windows Hello, your device, or a
              compatible security key.
            </p>

            <button
              type="button"
              onClick={handlePasskeyRegistration}
              disabled={passkeyLoading}
              className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passkeyLoading ? 'Registering passkey...' : 'Register a passkey'}
            </button>
          </div>
        )}

        {nextStep === 'MFA_VERIFICATION_REQUIRED' &&
          availableMethods.includes('PASSKEY') && (
            <div className="border-admin-border mt-6 space-y-3 rounded-lg border p-4">
              <h2 className="text-sm font-semibold">Verify your identity</h2>

              <p className="text-admin-muted text-sm">
                Use your registered passkey to complete authentication.
              </p>

              <button
                type="button"
                onClick={handlePasskeyAuthentication}
                disabled={passkeyLoading}
                className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passkeyLoading
                  ? 'Verifying passkey...'
                  : 'Sign in with passkey'}
              </button>
            </div>
          )}

        {nextStep === 'MFA_VERIFICATION_REQUIRED' &&
          !availableMethods.includes('PASSKEY') &&
          availableMethods.includes('TOTP') && (
            <p className="text-admin-muted border-admin-border mt-6 rounded-lg border p-4 text-sm">
              Authenticator verification is required. The TOTP verification
              interface has not been added yet.
            </p>
          )}

        {nextStep === 'AUTHENTICATED' && (
          <p
            role="status"
            className="border-admin-accent/30 bg-admin-accent/10 text-admin-accent mt-5 rounded-lg border p-3 text-sm"
          >
            Multi-factor authentication successful.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {nextStep &&
          nextStep !== 'MFA_ENROLLMENT_REQUIRED' &&
          nextStep !== 'MFA_VERIFICATION_REQUIRED' &&
          nextStep !== 'AUTHENTICATED' && (
            <p role="status" className="mt-5 rounded-lg border p-3 text-sm">
              Password accepted. Next step: {nextStep}
            </p>
          )}

        <p className="border-admin-border text-admin-muted mt-8 border-t pt-5 text-center text-xs">
          Restricted administrative access
        </p>
      </section>
    </main>
  )
}
