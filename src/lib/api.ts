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

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------

export interface User {
  id: number
  email: string
  username: string
  name: string | null
  nameIsPublic: boolean
  createdAt: string
}

export interface UpdateUserInput {
  email?: string
  username?: string
  name?: string
  nameIsPublic?: boolean
}

interface ApiResponse<T> {
  data: T
}

export const usersApi = {
  // GET /api/users
  list() {
    return api.get<ApiResponse<User[]>>('/api/users')
  },

  // GET /api/users/:id
  get(id: number) {
    return api.get<ApiResponse<User>>(`/api/users/${id}`)
  },

  // PATCH /api/users/:id
  update(id: number, data: UpdateUserInput) {
    return api.patch<ApiResponse<User>>(`/api/users/${id}`, data)
  },

  // DELETE /api/users/:id
  delete(id: number) {
    return api.delete<void>(`/api/users/${id}`)
  },
}

// -----------------------------------------------------------------------------
// Profiles
// -----------------------------------------------------------------------------

export interface PublicProfile {
  id: number
  username: string
  name?: string
}

export const profilesApi = {
  // GET /api/profiles/:id
  get(id: number) {
    return api.get<ApiResponse<PublicProfile>>(`/api/profiles/${id}`, {
      authenticated: false,
    })
  },
}

// -----------------------------------------------------------------------------
// Media
// -----------------------------------------------------------------------------

export type MediaStatus =
  'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETING'

export type MediaContentType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface CreateMediaUploadInput {
  filename: string
  contentType: MediaContentType
  size: number
}

export interface CreateMediaUploadResponse {
  id: string
  uploadUrl: string
  method: 'PUT'
  headers: {
    'Content-Type': MediaContentType
  }
  expiresIn: number
}

export interface CompleteMediaUploadResponse {
  id: string
  status: MediaStatus
}

export interface OriginalDownloadResponse {
  url: string
  expiresIn: number
}

interface MediaApiResponse<T> {
  data: T
}

const MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_MEDIA_TYPES: MediaContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export const mediaApi = {
  // POST /api/media/uploads
  async createUpload(input: CreateMediaUploadInput) {
    const response = await api.post<
      MediaApiResponse<CreateMediaUploadResponse>
    >('/api/media/uploads', input)

    return response.data
  },

  // DELETE /api/media/uploads/:id
  async cancelUpload(id: string) {
    return api.delete<void>(`/api/media/uploads/${id}`)
  },

  // Upload the actual file directly to Backblaze B2.
  async uploadFile(upload: CreateMediaUploadResponse, file: File) {
    const response = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: upload.headers,
      body: file,
      credentials: 'omit',
    })

    if (!response.ok) {
      const message = await response.text()

      throw new ApiError(message || 'File upload failed', response.status)
    }
  },

  // POST /api/media/:id/complete
  async complete(id: string) {
    const response = await api.post<
      MediaApiResponse<CompleteMediaUploadResponse>
    >(`/api/media/${id}/complete`)

    return response.data
  },

  // GET /api/media/:id/original
  async getOriginalDownloadUrl(id: string) {
    const response = await api.get<MediaApiResponse<OriginalDownloadResponse>>(
      `/api/media/${id}/original`,
    )

    return response.data
  },

  // Complete upload workflow.
  async upload(file: File) {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type as MediaContentType)) {
      throw new Error('Only JPEG, PNG and WebP images are supported')
    }

    if (file.size <= 0 || file.size > MAX_MEDIA_FILE_SIZE) {
      throw new Error('File must be between 1 byte and 10 MB')
    }

    const upload = await this.createUpload({
      filename: file.name,
      contentType: file.type as MediaContentType,
      size: file.size,
    })

    try {
      await this.uploadFile(upload, file)

      return await this.complete(upload.id)
    } catch (error) {
      try {
        await this.cancelUpload(upload.id)
      } catch (cleanupError) {
        console.error('Failed to cancel media upload:', cleanupError)
      }

      throw error
    }
  },
}

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

export interface AuthUser {
  id: number
  email: string
  username: string
  name: string | null
}

interface AuthResponse {
  data: {
    accessToken: string
    tokenType: 'Bearer'
    expiresIn: string
    user: AuthUser
  }
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  username: string
  name?: string
}

export const authApi = {
  async register(input: RegisterInput) {
    return api.post('/api/auth/register', input, {
      authenticated: false,
    })
  },

  async login(credentials: LoginInput) {
    const response = await api.post<AuthResponse>(
      '/api/auth/login',
      credentials,
      { authenticated: false },
    )

    setAccessToken(response.data.accessToken)

    return response.data
  },

  async refresh() {
    const response = await api.post<AuthResponse>(
      '/api/auth/refresh',
      undefined,
      { authenticated: false },
    )

    setAccessToken(response.data.accessToken)

    return response.data
  },

  logout() {
    clearAccessToken()

    return api.post<void>('/api/auth/logout', undefined, {
      authenticated: false,
    })
  },
}
