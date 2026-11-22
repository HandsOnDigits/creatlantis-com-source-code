import type { ProfileWidgetType } from './types/profile'

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

const CHAT_API_BASE_URL = (
  import.meta.env.VITE_CHAT_API_URL ?? 'http://localhost:3002'
).replace(/\/$/, '')

const MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_MEDIA_TYPES: MediaContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export interface CreateAvatarUploadInput {
  filename: string
  contentType: MediaContentType
  size: number
}

interface AvatarApiResponse<T> {
  data: T
}

// Access token stays in memory.
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

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

export async function chatApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json')

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${CHAT_API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'omit',
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
        ? (result as { error?: string; details?: unknown })
        : undefined

    throw new ApiError(
      errorData?.error ?? `Chat request failed (${response.status})`,
      response.status,
      errorData?.details,
    )
  }

  return result as T
}

export interface ProfileWidget {
  id: string
  type: ProfileWidgetType
}

export interface ProfileColumn {
  id: 'main' | 'sidebar'
  widgets: ProfileWidget[]
}

export interface ProfileLayout {
  columns: ProfileColumn[]
}

export interface ProfileLayoutResponse {
  version: number
  layout: ProfileLayout
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

  put<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return apiRequest<T>(path, {
      ...options,
      method: 'PUT',
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
  birthDate: string | null
  birthDateIsPublic: boolean
  avatarUrl: string | null
  gender: string | null
  genderIsPublic: boolean
  createdAt: string
}

export interface UserDirectoryEntry {
  id: number
  username: string
  name?: string
  tagline: string | null
  createdAt: string
  avatarUrl: string | null
}

export interface UpdateUserInput {
  email?: string
  username?: string
  name?: string
  nameIsPublic?: boolean
  birthDate?: string | null
  gender?: string | null
  genderIsPublic?: boolean
  birthDateIsPublic?: boolean
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

  directory(
    page = 1,
    limit = 24,
    sort: 'newest' | 'alphabetical' = 'newest',
    search?: string,
  ) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort,
    })

    if (search) {
      params.set('search', search)
    }

    return api.get<
      ApiResponse<UserDirectoryEntry[]> & {
        pagination: {
          page: number
          limit: number
          hasMore: boolean
        }
      }
    >(`/api/users/directory?${params}`, {
      authenticated: false,
    })
  },
}

// -----------------------------------------------------------------------------
// Profiles
// -----------------------------------------------------------------------------

export interface PublicProfile {
  id: number
  username: string
  name?: string
  birthDate?: string
  gender?: string
  tagline: string | null
  createdAt: string
  avatarUrl: string | null

  customization: PublicProfileCustomization

  layout: ProfileLayoutResponse
}

export const profilesApi = {
  // GET /api/profiles/:id
  get(id: number) {
    return api.get<ApiResponse<PublicProfile>>(`/api/profiles/${id}`, {
      authenticated: false,
    })
  },

  getMyCustomization() {
    return api.get<ApiResponse<ProfileCustomization>>(
      '/api/profiles/me/customization',
    )
  },

  updateMyCustomization(data: UpdateProfileCustomizationInput) {
    return api.put<ApiResponse<ProfileCustomization>>(
      '/api/profiles/me/customization',
      data,
    )
  },

  getCustomization(id: number) {
    return api.get<ApiResponse<PublicProfileCustomization>>(
      `/api/profiles/${id}/customization`,
      { authenticated: false },
    )
  },

  // GET /api/profiles/username/:username
  getByUsername(username: string) {
    return api.get<ApiResponse<PublicProfile>>(
      `/api/profiles/username/${encodeURIComponent(username)}`,
      { authenticated: false },
    )
  },

  // GET /api/profiles/username/:username/customization
  getCustomizationByUsername(username: string) {
    return api.get<ApiResponse<PublicProfileCustomization>>(
      `/api/profiles/username/${encodeURIComponent(username)}/customization`,
      { authenticated: false },
    )
  },

  getMyLayout() {
    return api.get<ApiResponse<ProfileLayoutResponse>>(
      '/api/profiles/me/layout',
    )
  },

  updateMyLayout(layout: ProfileLayout) {
    return api.put<ApiResponse<ProfileLayoutResponse>>(
      '/api/profiles/me/layout',
      { layout },
    )
  },

  getLayoutByUsername(username: string) {
    return api.get<ApiResponse<ProfileLayoutResponse>>(
      `/api/profiles/username/${encodeURIComponent(username)}/layout`,
      { authenticated: false },
    )
  },

  updateMyTagline: (tagline: string | null) =>
    api.put<ApiResponse<{ tagline: string | null }>>(
      '/api/profiles/me/tagline',
      { tagline },
    ),
}

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  createdAt: string
}

export const categoriesApi = {
  // GET /api/categories
  list() {
    return api.get<ApiResponse<Category[]>>('/api/categories', {
      authenticated: false,
    })
  },

  // GET /api/categories/:id
  get(id: number) {
    return api.get<ApiResponse<Category>>(`/api/categories/${id}`, {
      authenticated: false,
    })
  },
}

// -----------------------------------------------------------------------------
// Posts
// -----------------------------------------------------------------------------

export type PostType = 'IMAGE' | 'JOURNAL' | 'MODEL'

export interface PostImageVariant {
  format: 'WEBP' | 'AVIF'
  width: number
  height: number
  url: string
}

export interface PostImage {
  id: string
  width: number | null
  height: number | null
  variants: PostImageVariant[]
}

export interface PostAuthor {
  id: number
  username: string
  name: string | null
  avatarUrl: string | null
}

export interface PostListResponse {
  data: Post[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}

export interface Post {
  id: number
  type: PostType
  title: string
  content: string | null
  createdAt: string
  authorId: number
  author?: PostAuthor | null
  images?: PostImage[]
}

export interface CreatePostInput {
  type?: PostType
  title: string
  content?: string | null
  mediaIds?: string[]
  categoryIds?: number[]
}

export interface ProfileCustomization {
  id?: string
  userId?: number
  description: string
  customCss: string
  createdAt?: string
  updatedAt?: string
}

export interface PublicProfileCustomization {
  descriptionHtml: string
}

export interface UpdateProfileCustomizationInput {
  description?: string
  customCss?: string
}

export const postsApi = {
  // GET /api/posts
  list(page = 1, limit = 10, categoryId?: number) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    if (categoryId !== undefined) {
      params.set('categoryId', String(categoryId))
    }

    return api.get<PostListResponse>(`/api/posts?${params}`, {
      authenticated: false,
    })
  },

  // GET /api/posts/:id
  get(id: number) {
    return api.get<ApiResponse<Post>>(`/api/posts/${id}`, {
      authenticated: false,
    })
  },

  // POST /api/posts
  create(input: CreatePostInput) {
    return api.post<ApiResponse<Post>>('/api/posts', input)
  },

  listByUsername(
    username: string,
    page = 1,
    limit = 12,
    type?: 'IMAGE' | 'JOURNAL',
  ) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    if (type) {
      params.set('type', type)
    }

    return api.get<PostListResponse>(
      `/api/posts/user/${encodeURIComponent(username)}?${params}`,
      { authenticated: false },
    )
  },
}

// -----------------------------------------------------------------------------
// Media
// -----------------------------------------------------------------------------

export type MediaStatus =
  'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETING'

export type MediaUploadStage = 'UPLOADING' | 'COMPLETING' | MediaStatus

export type MediaContentType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

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
  async uploadFile(
    upload: CreateMediaUploadResponse,
    file: File,
    signal?: AbortSignal,
  ) {
    const response = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: upload.headers,
      body: file,
      credentials: 'omit',
      signal,
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
      signal?: AbortSignal
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

      await this.uploadFile(upload, file, options.signal)

      options.onStatusChange?.('COMPLETING')

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

export interface AvatarUploadResponse {
  id: string
  uploadUrl: string
  method: 'PUT'
  headers: {
    'Content-Type': string
  }
  expiresAt: string
  expiresIn: number
}

export const avatarsApi = {
  async createUpload(input: CreateAvatarUploadInput) {
    const response = await api.post<AvatarApiResponse<AvatarUploadResponse>>(
      '/api/avatars/upload',
      input,
    )

    return response.data
  },

  async uploadFile(upload: AvatarUploadResponse, file: File) {
    const response = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: upload.headers,
      body: file,
      credentials: 'omit',
    })

    if (!response.ok) {
      const message = await response.text()
      throw new ApiError(message || 'Avatar upload failed', response.status)
    }
  },

  async complete(id: string) {
    const response = await api.post<
      AvatarApiResponse<{
        status: 'PENDING_APPROVAL'
        message: string
      }>
    >('/api/avatars/complete', { id })

    return response.data
  },

  async upload(file: File) {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type as MediaContentType)) {
      throw new Error('Only JPEG, PNG, WebP and GIF images are supported.')
    }

    if (file.size <= 0 || file.size > MAX_AVATAR_FILE_SIZE) {
      throw new Error('Avatar must be between 1 byte and 5 MB.')
    }

    const upload = await this.createUpload({
      filename: file.name,
      contentType: file.type as MediaContentType,
      size: file.size,
    })

    let completed = false

    try {
      await this.uploadFile(upload, file)

      const result = await this.complete(upload.id)
      completed = true

      return result
    } catch (error) {
      if (!completed) {
        console.error('Avatar upload failed:', error)
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

  // POST /api/auth/change-password
  changePassword(data: { currentPassword: string; newPassword: string }) {
    return api.post<{ message: string }>('/api/auth/change-password', data)
  },
}

// -----------------------------------------------------------------------------
// Notes (Private Messages)
// -----------------------------------------------------------------------------

export interface NotesConversationMembership {
  conversationId: string
  startedByIdentityId: string
  lastReadAt: string | null
  mutedAt: string | null
  recipient: {
    identityId: string
    username: string
    name: string | null
    avatarUrl: string | null
  } | null
  lastMessageAt: string | null
  lastMessage: {
    content: string
    createdAt: string
    senderIdentityId: string | null
  } | null
  unreadCount: number
}

export interface NotesConversationsResponse {
  conversations: NotesConversationMembership[]
}

export interface NotesMessage {
  id: string
  conversationId: string
  senderIdentityId: string | null
  content: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

export interface NotesMessagesResponse {
  messages: NotesMessage[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}

export const notesApi = {
  // GET /api/notes/conversations
  listConversations() {
    return chatApiRequest<NotesConversationsResponse>(
      '/api/notes/conversations',
    )
  },

  // GET /api/notes/conversations/:conversationId/messages
  listMessages(conversationId: string, page = 1, limit = 50) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    return chatApiRequest<NotesMessagesResponse>(
      `/api/notes/conversations/${encodeURIComponent(conversationId)}/messages?${params}`,
    )
  },

  // POST /api/notes/conversations/:conversationId/messages
  sendMessage(conversationId: string, content: string) {
    return chatApiRequest<{ message: NotesMessage }>(
      `/api/notes/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
    )
  },

  // POST /api/notes/conversations/:conversationId/read
  markRead(conversationId: string) {
    return chatApiRequest<{
      conversationId: string
      lastReadAt: string
    }>(`/api/notes/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
    })
  },

  deleteMessage(conversationId: string, messageId: string) {
    return chatApiRequest<{ deleted: boolean }>(
      `/api/notes/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    )
  },

  endConversation(conversationId: string) {
    return chatApiRequest<{ ended: boolean }>(
      `/api/notes/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' },
    )
  },
}
