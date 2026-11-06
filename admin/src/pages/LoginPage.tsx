import { useState, type FormEvent } from 'react'

interface LoginResponse {
  admin?: {
    id: string
    email: string
    role: string
  }
  nextStep?: string
  error?: string
  message?: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nextStep, setNextStep] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setNextStep('')
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setLoading(false)
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
              className="border-admin-border bg-admin-bg focus:border-admin-accent focus:ring-admin-accent/20 w-full rounded-lg border px-4 py-3 text-sm transition outline-none placeholder:text-gray-600 focus:ring-2"
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
              className="border-admin-border bg-admin-bg focus:border-admin-accent focus:ring-admin-accent/20 w-full rounded-lg border px-4 py-3 text-sm transition outline-none placeholder:text-gray-600 focus:ring-2"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-admin-accent w-full rounded-lg px-4 py-3 text-sm font-semibold text-gray-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {nextStep && (
          <p
            role="status"
            className="border-admin-accent/30 bg-admin-accent/10 text-admin-accent mt-5 rounded-lg border p-3 text-sm"
          >
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
