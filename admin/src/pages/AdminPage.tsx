import { useCallback, useEffect, useState } from 'react'

interface PendingMedia {
  id: string
  originalFilename: string
  originalMimeType: string
  originalSize: number | string | null
  width: number | null
  height: number | null
  originalUrl: string
  variants: {
    width: number
    height: number
    format: string
    url: string
  }[]
}

interface PendingPost {
  id: number
  type: string
  title: string
  content: string | null
  createdAt: string
  author: {
    id: number
    username: string
    name: string | null
  } | null
  media: PendingMedia[]
}

interface PendingResponse {
  data: PendingPost[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}

const API_URL = 'http://localhost:3001/api'

export default function AdminPage() {
  const [posts, setPosts] = useState<PendingPost[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyPostId, setBusyPostId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectingPostId, setRejectingPostId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const loadPending = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/pending?page=${targetPage}&limit=10`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to load pending posts.')
      }

      const data = result as PendingResponse

      setPosts(data.data)
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
    void loadPending(1)
  }, [loadPending])

  async function moderatePost(postId: number, action: 'approve' | 'reject') {
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }

    setBusyPostId(postId)
    setError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/${postId}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          ...(action === 'reject'
            ? { body: JSON.stringify({ reason: rejectionReason.trim() }) }
            : {}),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? `Unable to ${action} post.`)
      }

      setRejectingPostId(null)
      setRejectionReason('')
      await loadPending(page)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setBusyPostId(null)
    }
  }

  async function handleLogout() {
    setError(null)

    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Unable to log out. Please try again.')
      }

      window.location.assign('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log out.')
    }
  }

  return (
    <main className="bg-admin-bg min-h-screen p-8 text-white">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CreAtlantis Administration</h1>
          <p className="text-admin-muted mt-2">Content moderation</p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-white/5"
        >
          Sign out
        </button>
      </header>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Pending approval</h2>
          <button
            type="button"
            onClick={() => void loadPending(page)}
            disabled={loading}
            className="border-admin-border rounded-lg border px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
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
          <p className="text-admin-muted">Loading pending posts...</p>
        ) : posts.length === 0 ? (
          <p className="text-admin-muted">No posts awaiting approval.</p>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <article
                key={post.id}
                className="border-admin-border rounded-xl border bg-white/2 p-5"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{post.title}</h3>
                    <p className="text-admin-muted mt-1 text-sm">
                      Post #{post.id} · {post.type}
                    </p>
                    <p className="text-admin-muted mt-1 text-sm">
                      By {post.author?.username ?? 'Unknown author'}
                      {post.author?.name ? ` (${post.author.name})` : ''}
                    </p>
                  </div>

                  <time className="text-admin-muted text-sm">
                    {new Date(post.createdAt).toLocaleString()}
                  </time>
                </div>

                {post.content && (
                  <p className="mb-4 text-sm whitespace-pre-wrap text-white/80">
                    {post.content}
                  </p>
                )}

                {post.media.length > 0 && (
                  <div className="mb-5 flex flex-wrap gap-3">
                    {post.media.map((media) => (
                      <a
                        key={media.id}
                        href={media.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open original: ${media.originalFilename}`}
                      >
                        <img
                          src={media.variants[0]?.url ?? media.originalUrl}
                          alt={media.originalFilename}
                          className="h-40 w-40 rounded-lg border border-white/10 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void moderatePost(post.id, 'approve')}
                    disabled={busyPostId !== null}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                  >
                    {busyPostId === post.id ? 'Processing...' : 'Approve'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRejectingPostId(
                        rejectingPostId === post.id ? null : post.id,
                      )
                      setRejectionReason('')
                      setError(null)
                    }}
                    disabled={busyPostId !== null}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>

                {rejectingPostId === post.id && (
                  <div className="mt-4 space-y-3">
                    <label
                      htmlFor={`rejection-reason-${post.id}`}
                      className="block text-sm font-medium"
                    >
                      Rejection reason
                    </label>

                    <textarea
                      id={`rejection-reason-${post.id}`}
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(event.target.value)
                      }
                      maxLength={2000}
                      rows={3}
                      placeholder="Explain why this post is being rejected..."
                      className="border-admin-border w-full rounded-lg border bg-black/20 p-3 text-sm outline-none focus:border-white/40"
                    />

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => void moderatePost(post.id, 'reject')}
                        disabled={
                          busyPostId !== null || !rejectionReason.trim()
                        }
                        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                      >
                        Confirm rejection
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRejectingPostId(null)
                          setRejectionReason('')
                        }}
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
            onClick={() => void loadPending(page - 1)}
            disabled={loading || page <= 1}
            className="border-admin-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-admin-muted text-sm">Page {page}</span>

          <button
            type="button"
            onClick={() => void loadPending(page + 1)}
            disabled={loading || !hasMore}
            className="border-admin-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </main>
  )
}
