import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth, AuthStatus } from '../AuthContext'

import { VerticalHR } from '../Utilites'

function Register() {
  const { register, status } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteKey, setInviteKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (status === AuthStatus.Loading) {
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
      await register({
        email,
        username,
        password,
        inviteKey,
      })

      navigate('/login', {
        replace: true,
        state: { registrationComplete: true },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mt-12 flex justify-center">
      <form onSubmit={handleSubmit} id="register" className="w-2/3">
        <h1 className="extra-big-text">Create account</h1>

        <br />

        <div className="submit-input">
          <label htmlFor="inviteKey">Invite key</label>
          <input
            id="inviteKey"
            type="text"
            autoComplete="off"
            value={inviteKey}
            onChange={(event) => setInviteKey(event.target.value)}
            minLength={43}
            maxLength={43}
            pattern="[A-Za-z0-9_-]{43}"
            required
          />
        </div>

        <div className="submit-input">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
          />
        </div>

        <div className="submit-input">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={50}
            pattern="[A-Za-z0-9_]+"
            required
          />
        </div>

        <div className="submit-input">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
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
              {loading ? 'Creating account...' : 'Sign up'}
            </button>

            <VerticalHR />
          </div>
        </div>

        <p className="mt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  )
}

export default Register
