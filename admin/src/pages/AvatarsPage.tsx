import { useCallback, useEffect, useState } from 'react'

interface PendingAvatar {
  id: string
  originalFilename: string | null
  mimeType: string | null
  size: number | null
  width: number | null
  height: number | null
  createdAt: string
  previewUrl: string | null
  author: {
    id: number
    username: string
    name: string | null
  } | null
}

interface PendingAvatarsResponse {
  data: PendingAvatar[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}

const API_URL = 'http://localhost:3001/api'

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<PendingAvatar[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busyAvatarId, setBusyAvatarId] = useState<string | null>(null)
  const [rejectingAvatarId, setRejectingAvatarId] = useState<string | null>(
    null,
  )
  const [rejectionReason, setRejectionReason] = useState('')

  const loadPendingAvatars = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/avatars/pending?page=${targetPage}&limit=10`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to load pending avatars.')
      }

      const data = result as PendingAvatarsResponse

      setAvatars(data.data)
      setPage(data.pagination.page)
      setHasMore(data.pagination.hasMore)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPendingAvatars(1)
  }, [loadPendingAvatars])

  async function moderateAvatar(
    avatarId: string,
    action: 'approve' | 'reject',
  ) {
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }

    setBusyAvatarId(avatarId)
    setError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/avatars/${avatarId}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          ...(action === 'reject'
            ? {
                body: JSON.stringify({
                  reason: rejectionReason.trim(),
                }),
              }
            : {}),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? `Unable to ${action} avatar.`)
      }

      setRejectingAvatarId(null)
      setRejectionReason('')

      await loadPendingAvatars(page)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setBusyAvatarId(null)
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Avatar moderation</h1>
          <p className="text-admin-muted mt-2 text-sm">
            Review profile avatar uploads before they become public.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPendingAvatars(page)}
          disabled={loading}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-admin-muted">Loading pending avatars...</p>
      ) : avatars.length === 0 ? (
        <div className="border-admin-border rounded-xl border p-8 text-center">
          <p className="font-medium">No avatars awaiting approval</p>
          <p className="text-admin-muted mt-2 text-sm">
            New avatar submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {avatars.map((avatar) => (
            <article
              key={avatar.id}
              className="border-admin-border rounded-xl border bg-white/2 p-5"
            >
              <div className="flex flex-wrap items-start gap-5">
                {avatar.previewUrl ? (
                  <a
                    href={avatar.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open original avatar"
                  >
                    <img
                      src={avatar.previewUrl}
                      alt={`Pending avatar for ${avatar.author?.username ?? 'user'}`}
                      className="h-32 w-32 rounded-xl border border-white/10 object-cover"
                    />
                  </a>
                ) : (
                  <div className="text-admin-muted flex h-32 w-32 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
                    No preview
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">
                    {avatar.author?.username ?? 'Unknown user'}
                  </h2>

                  {avatar.author?.name && (
                    <p className="text-admin-muted mt-1 text-sm">
                      {avatar.author.name}
                    </p>
                  )}

                  <div className="text-admin-muted mt-3 space-y-1 text-sm">
                    <p>User ID: {avatar.author?.id ?? 'Unavailable'}</p>
                    <p>Filename: {avatar.originalFilename ?? 'Unknown'}</p>
                    <p>MIME type: {avatar.mimeType ?? 'Unknown'}</p>
                    <p>
                      Size:{' '}
                      {avatar.size !== null
                        ? `${(avatar.size / 1024).toFixed(1)} KB`
                        : 'Unknown'}
                    </p>
                    <p>
                      Dimensions: {avatar.width ?? '?'} × {avatar.height ?? '?'}
                    </p>
                    <p>
                      Submitted: {new Date(avatar.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs">Avatar ID: {avatar.id}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void moderateAvatar(avatar.id, 'approve')}
                  disabled={busyAvatarId !== null}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                >
                  {busyAvatarId === avatar.id ? 'Processing...' : 'Approve'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRejectingAvatarId(
                      rejectingAvatarId === avatar.id ? null : avatar.id,
                    )
                    setRejectionReason('')
                    setError(null)
                  }}
                  disabled={busyAvatarId !== null}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>

              {rejectingAvatarId === avatar.id && (
                <div className="mt-4 space-y-3">
                  <label
                    htmlFor={`avatar-rejection-${avatar.id}`}
                    className="block text-sm font-medium"
                  >
                    Rejection reason
                  </label>

                  <textarea
                    id={`avatar-rejection-${avatar.id}`}
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    maxLength={2000}
                    rows={3}
                    disabled={busyAvatarId !== null}
                    placeholder="Explain why this avatar is being rejected..."
                    className="border-admin-border w-full rounded-lg border bg-black/20 p-3 text-sm outline-none focus:border-white/40"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void moderateAvatar(avatar.id, 'reject')}
                      disabled={
                        busyAvatarId !== null || !rejectionReason.trim()
                      }
                      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                    >
                      Confirm rejection
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRejectingAvatarId(null)
                        setRejectionReason('')
                      }}
                      disabled={busyAvatarId !== null}
                      className="border-admin-border rounded-lg border px-4 py-2 text-sm hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void loadPendingAvatars(page - 1)}
          disabled={loading || page <= 1}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>

        <span className="text-admin-muted text-sm">Page {page}</span>

        <button
          type="button"
          onClick={() => void loadPendingAvatars(page + 1)}
          disabled={loading || !hasMore}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  )
}
