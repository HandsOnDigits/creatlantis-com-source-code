import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, AuthStatus } from '../AuthContext'

import { VerticalHR } from '../Utilites'

function Login() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname ?? '/'

  if (status === 'loading') {
    return <p>Checking session...</p>
  }

  if (status === AuthStatus.Authenticated) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mt-12 flex justify-center">
      <form onSubmit={handleSubmit} id="login" className="w-2/3">
        <h1 className="extra-big-text">Log in</h1>

        <br />

        <div className="submit-input">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="submit-input">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && (
          <p role="alert" id="error-feedback">
            {error}
          </p>
        )}

        <br />

        <div className="light-to-dark-gradient flex justify-around">
          <div className="flex items-center gap-4">
            <VerticalHR />

            <button type="submit" disabled={loading} className="login">
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <VerticalHR />
          </div>
        </div>
      </form>
    </main>
  )
}

export default Login
