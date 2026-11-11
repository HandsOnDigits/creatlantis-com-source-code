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
// Posts
// -----------------------------------------------------------------------------

export type PostType = 'IMAGE' | 'JOURNAL' | 'MODEL'

export interface Post {
  id: number
  type: PostType
  title: string
  content: string | null
  createdAt: string
  authorId: number
}

export interface CreatePostInput {
  type?: PostType
  title: string
  content?: string | null
  mediaIds?: string[]
}

export const postsApi = {
  // GET /api/posts
  list(page = 1, limit = 10) {
    return api.get<
      ApiResponse<{
        data: Post[]
        pagination: {
          page: number
          limit: number
          hasMore: boolean
        }
      }>
    >(`/api/posts?page=${page}&limit=${limit}`)
  },

  // GET /api/posts/:id
  get(id: number) {
    return api.get<ApiResponse<Post>>(`/api/posts/${id}`)
  },

  // POST /api/posts
  create(input: CreatePostInput) {
    return api.post<ApiResponse<Post>>('/api/posts', input)
  },
}

// -----------------------------------------------------------------------------
// Media
// -----------------------------------------------------------------------------

export type MediaStatus =
  'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETING'

export type MediaUploadStage = 'UPLOADING' | MediaStatus

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

export interface MediaVariant {
  format: 'WEBP'
  width: number
  height: number
  size: number
  url: string
  expiresIn: number | null
}

export interface MediaStatusResponse {
  id: string
  status: MediaStatus
  width: number | null
  height: number | null
  processingAttempts: number
  processingError: string | null
  processedAt: string | null
  variants: MediaVariant[]
}

export interface OriginalDownloadResponse {
  url: string
  expiresIn: number | null
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

  // GET /api/media/:id/status
  async getStatus(id: string) {
    const response = await api.get<MediaApiResponse<MediaStatusResponse>>(
      `/api/media/${id}/status`,
    )

    return response.data
  },

  // POST /api/media/:id/complete
  async complete(id: string) {
    const response = await api.post<
      MediaApiResponse<CompleteMediaUploadResponse>
    >(`/api/media/${id}/complete`)

    return response.data
  },

  // Poll until media processing finishes.
  async waitForProcessing(
    id: string,
    options: {
      interval?: number
      timeout?: number
      onStatusChange?: (status: MediaUploadStage) => void
    } = {},
  ): Promise<MediaStatusResponse> {
    const interval = options.interval ?? 1000
    const timeout = options.timeout ?? 120_000
    const startedAt = Date.now()

    let previousStatus: MediaStatus | null = null

    while (Date.now() - startedAt < timeout) {
      const media = await this.getStatus(id)

      if (media.status !== previousStatus) {
        options.onStatusChange?.(media.status)
        previousStatus = media.status
      }

      if (media.status === 'READY') {
        return media
      }

      if (media.status === 'FAILED') {
        throw new Error(media.processingError ?? 'Image processing failed')
      }

      if (media.status === 'DELETING') {
        throw new Error('Media is being deleted')
      }

      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new Error('Image processing timed out')
  },

  // GET /api/media/:id/original
  async getOriginalDownloadUrl(id: string) {
    const response = await api.get<MediaApiResponse<OriginalDownloadResponse>>(
      `/api/media/${id}/original`,
    )

    return response.data
  },

  // Complete upload and optionally wait for image processing.
  async upload(
    file: File,
    options: {
      waitForProcessing?: boolean
      processingInterval?: number
      processingTimeout?: number
      onStatusChange?: (status: MediaUploadStage) => void
    } = {},
  ) {
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

    let completed = false

    try {
      options.onStatusChange?.('UPLOADING')

      await this.uploadFile(upload, file)

      const result = await this.complete(upload.id)
      completed = true

      options.onStatusChange?.(result.status)

      if (!options.waitForProcessing) {
        return result
      }

      return await this.waitForProcessing(upload.id, {
        interval: options.processingInterval,
        timeout: options.processingTimeout,
        onStatusChange: options.onStatusChange,
      })
    } catch (error) {
      if (!completed) {
        try {
          await this.cancelUpload(upload.id)
        } catch (cleanupError) {
          console.error('Failed to cancel media upload:', cleanupError)
        }
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

// Temporary development-only moderation media tests.
export const mediaDebugApi = {
  getStatus(id: string) {
    return mediaApi.getStatus(id)
  },

  getOriginal(id: string) {
    return mediaApi.getOriginalDownloadUrl(id)
  },
}
