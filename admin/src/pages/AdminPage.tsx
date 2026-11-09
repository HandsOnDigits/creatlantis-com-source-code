import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogout() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Unable to log out. Please try again.')
      }

      navigate('/login', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-admin-bg min-h-screen p-8 text-white">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CreAtlantis Administration</h1>

          <p className="text-admin-muted mt-2">
            Administrator authentication successful.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? 'Signing out...' : 'Sign out'}
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}
    </main>
  )
}
