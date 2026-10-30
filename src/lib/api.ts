const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

// Access token stays in memory.
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

export class ApiError extends Error {
  public readonly status: number
  public readonly details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)

    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    authenticated = true,
    headers: requestHeaders,
    ...requestOptions
  } = options

  const headers = new Headers(requestHeaders)

  headers.set('Accept', 'application/json')

  if (requestOptions.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (authenticated && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type')
  const isJson = contentType?.includes('application/json')

  const result: unknown = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const errorData =
      typeof result === 'object' && result !== null
        ? (result as {
            error?: string
            details?: unknown
          })
        : undefined

    throw new ApiError(
      errorData?.error ?? `Request failed (${response.status})`,
      response.status,
      errorData?.details,
    )
  }

  return result as T
}

// Convenience methods
export const api = {
  get<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: 'GET',
    })
  },

  post<T>(path: string, body?: unknown, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },

  patch<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  delete<T>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: 'DELETE',
    })
  },
}
