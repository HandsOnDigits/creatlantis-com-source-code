import { useState, type FormEvent } from 'react'
import { authenticateAdminPasskey, registerAdminPasskey } from '../lib/passkeys'
import { startTotpEnrollment, confirmTotpEnrollment } from '../lib/totp'
import type { TotpEnrollment } from '../lib/totp'
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
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [totpLoading, setTotpLoading] = useState(false)
  const [error, setError] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [availableMethods, setAvailableMethods] = useState<
    ('TOTP' | 'PASSKEY')[]
  >([])
  const [selectedEnrollmentMethod, setSelectedEnrollmentMethod] = useState<
    'TOTP' | 'PASSKEY' | null
  >(null)
  const [totpEnrollment, setTotpEnrollment] = useState<TotpEnrollment | null>(
    null,
  )

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
    setSelectedEnrollmentMethod(null)
    setTotpEnrollment(null)
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
    setSelectedEnrollmentMethod('PASSKEY')
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

  async function handleTotpEnrollment() {
    setError('')
    setTotpLoading(true)

    try {
      const enrollment = await startTotpEnrollment()
      setTotpEnrollment(enrollment)
      setSelectedEnrollmentMethod('TOTP')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start authenticator enrollment.',
      )
    } finally {
      setTotpLoading(false)
    }
  }

  async function handleTotpEnrollmentConfirmation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setTotpLoading(true)

    try {
      await confirmTotpEnrollment(totpCode)
      await completeAuthentication()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Authenticator enrollment failed.',
      )
      setTotpCode('')
    } finally {
      setTotpLoading(false)
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

  async function handleTotpVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setTotpLoading(true)

    try {
      const response = await fetch(
        'http://localhost:3001/api/mfa/verification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ token: totpCode }),
        },
      )

      const data = (await response.json()) as {
        success?: boolean
        error?: string
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Authenticator verification failed.')
      }

      await completeAuthentication()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authenticator verification failed.',
      )
      setTotpCode('')
    } finally {
      setTotpLoading(false)
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
            disabled={
              loading || passkeyLoading || totpLoading || nextStep !== ''
            }
            className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {nextStep === 'MFA_ENROLLMENT_REQUIRED' && (
          <div className="border-admin-border mt-6 space-y-4 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">
              Choose your authentication method
            </h2>

            <p className="text-admin-muted text-sm">
              You must choose exactly one method. You cannot combine a passkey
              with an authenticator app.
            </p>

            {!selectedEnrollmentMethod && (
              <>
                <button
                  type="button"
                  onClick={handlePasskeyRegistration}
                  disabled={passkeyLoading || totpLoading}
                  className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passkeyLoading ? 'Registering passkey...' : 'Use a passkey'}
                </button>

                <button
                  type="button"
                  onClick={handleTotpEnrollment}
                  disabled={passkeyLoading || totpLoading}
                  className="border-admin-border w-full rounded-lg border px-4 py-3 text-sm font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {totpLoading
                    ? 'Preparing authenticator...'
                    : 'Use an authenticator app'}
                </button>
              </>
            )}

            {selectedEnrollmentMethod === 'PASSKEY' && (
              <p className="text-admin-muted text-sm">
                Passkey registration has been selected. Complete the
                registration prompt to continue.
              </p>
            )}

            {selectedEnrollmentMethod === 'TOTP' && totpEnrollment && (
              <div className="space-y-4">
                <p className="text-admin-muted text-sm">
                  Scan this QR code with your authenticator app, such as
                  Microsoft Authenticator, Google Authenticator, or 1Password.
                </p>

                <div className="flex justify-center rounded-lg bg-white p-4">
                  <img
                    src={totpEnrollment.qrCodeDataUrl}
                    alt="Authenticator enrollment QR code"
                    className="size-48"
                  />
                </div>

                <div>
                  <label
                    htmlFor="totpSecret"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Or enter this setup key manually
                  </label>

                  <code
                    id="totpSecret"
                    className="bg-admin-bg block rounded-lg p-3 text-sm break-all select-all"
                  >
                    {totpEnrollment.secret}
                  </code>
                </div>

                <form
                  onSubmit={handleTotpEnrollmentConfirmation}
                  className="space-y-3"
                >
                  <label
                    htmlFor="totpEnrollmentCode"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Enter the six-digit code from your app
                  </label>

                  <input
                    id="totpEnrollmentCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={totpCode}
                    onChange={(event) =>
                      setTotpCode(
                        event.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    required
                    disabled={totpLoading}
                    placeholder="000000"
                    className="border-admin-border bg-admin-bg focus:border-admin-accent w-full rounded-lg border px-4 py-3 text-center text-xl tracking-[0.4em] outline-none"
                  />

                  <button
                    type="submit"
                    disabled={totpCode.length !== 6 || totpLoading}
                    className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {totpLoading ? 'Confirming...' : 'Confirm authenticator'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {nextStep === 'MFA_VERIFICATION_REQUIRED' && (
          <div className="border-admin-border mt-6 space-y-5 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Verify your identity</h2>

            {availableMethods.includes('PASSKEY') && (
              <div className="space-y-3">
                <p className="text-admin-muted text-sm">
                  Use your registered passkey.
                </p>

                <button
                  type="button"
                  onClick={handlePasskeyAuthentication}
                  disabled={passkeyLoading || totpLoading}
                  className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passkeyLoading
                    ? 'Verifying passkey...'
                    : 'Sign in with passkey'}
                </button>
              </div>
            )}

            {availableMethods.includes('TOTP') && (
              <form onSubmit={handleTotpVerification} className="space-y-3">
                <label
                  htmlFor="totpCode"
                  className="block text-sm font-medium text-gray-300"
                >
                  Six-digit verification code
                </label>

                <input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(event) =>
                    setTotpCode(
                      event.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  required
                  disabled={totpLoading || passkeyLoading}
                  placeholder="000000"
                  className="border-admin-border bg-admin-bg focus:border-admin-accent w-full rounded-lg border px-4 py-3 text-center text-xl tracking-[0.4em] outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    totpCode.length !== 6 || totpLoading || passkeyLoading
                  }
                  className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {totpLoading ? 'Verifying code...' : 'Verify code'}
                </button>
              </form>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <p className="border-admin-border text-admin-muted mt-8 border-t pt-5 text-center text-xs">
          Restricted administrative access
        </p>
      </section>
    </main>
  )
}
