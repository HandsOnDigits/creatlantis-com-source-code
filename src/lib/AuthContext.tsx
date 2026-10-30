import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { api, ApiError, clearAccessToken, setAccessToken } from './api'

interface ApiResponse<T> {
  data: T
}

export interface AuthUser {
  id: number
  email: string
  username: string
  name: string | null
  nameIsPublic: boolean
  createdAt: string
}

export interface RegisterInput {
  email: string
  username: string
  password: string
  name?: string
}

export interface LoginInput {
  email: string
  password: string
}

interface AuthTokenResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: string
  user: Pick<AuthUser, 'id' | 'email' | 'username' | 'name'>
}

type RegisteredUser = Pick<
  AuthUser,
  'id' | 'email' | 'username' | 'name' | 'createdAt'
>

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  error: unknown | null
  login: (input: LoginInput) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<RegisteredUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Prevent simultaneous refresh-token rotations during startup.
let refreshPromise: Promise<AuthUser | null> | null = null

function restoreSession(): Promise<AuthUser | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await api.post<ApiResponse<AuthTokenResponse>>(
          '/api/auth/refresh',
          undefined,
          { authenticated: false },
        )

        setAccessToken(response.data.accessToken)

        const me = await api.get<ApiResponse<AuthUser>>('/api/auth/me')

        return me.data
      } catch (error) {
        clearAccessToken()

        if (error instanceof ApiError && error.status === 401) {
          return null
        }

        throw error
      }
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<unknown | null>(null)

  // Restore an existing session when the application starts.
  useEffect(() => {
    let active = true

    restoreSession()
      .then((restoredUser) => {
        if (!active) return

        setUser(restoredUser)
        setStatus(restoredUser ? 'authenticated' : 'unauthenticated')
      })
      .catch((error: unknown) => {
        if (!active) return

        setError(error)
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  async function login(input: LoginInput): Promise<AuthUser> {
    setError(null)

    const response = await api.post<ApiResponse<AuthTokenResponse>>(
      '/api/auth/login',
      input,
      { authenticated: false },
    )

    setAccessToken(response.data.accessToken)

    try {
      const me = await api.get<ApiResponse<AuthUser>>('/api/auth/me')

      setUser(me.data)
      setStatus('authenticated')

      return me.data
    } catch (error) {
      clearAccessToken()
      setUser(null)
      setStatus('unauthenticated')
      throw error
    }
  }

  async function register(input: RegisterInput): Promise<RegisteredUser> {
    const response = await api.post<ApiResponse<RegisteredUser>>(
      '/api/auth/register',
      input,
      { authenticated: false },
    )

    return response.data
  }

  async function logout(): Promise<void> {
    try {
      await api.post<void>('/api/auth/logout', undefined, {
        authenticated: false,
      })
    } finally {
      clearAccessToken()
      setUser(null)
      setError(null)
      setStatus('unauthenticated')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        error,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
