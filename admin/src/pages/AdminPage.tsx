import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface PendingCountResponse {
  pagination: {
    total: number
  }
}

interface DashboardCounts {
  posts: number
  avatars: number
  reports: number
}

const API_URL = 'http://localhost:3001/api'

async function fetchPendingCount(url: string): Promise<number> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
  })

  const result = (await response.json()) as PendingCountResponse

  if (!response.ok) {
    throw new Error('Could not load dashboard counts.')
  }

  return result.pagination.total
}

export default function AdminPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    try {
      const [posts, avatars, reports] = await Promise.all([
        fetchPendingCount(`${API_URL}/moderation/pending?limit=1`),
        fetchPendingCount(`${API_URL}/moderation/avatars/pending?limit=1`),
        fetchPendingCount(
          `${API_URL}/moderation/reports?status=PENDING&limit=1`,
        ),
      ])

      setCounts({ posts, avatars, reports })
      setError(null)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not load dashboard counts.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCounts()

    const interval = window.setInterval(() => {
      void loadCounts()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [loadCounts])

  const sections = [
    {
      title: 'Posts',
      description: 'Review and moderate posts awaiting approval.',
      path: '/admin/posts',
      count: counts?.posts,
    },
    {
      title: 'Avatars',
      description: 'Review user profile pictures awaiting approval.',
      path: '/admin/avatars',
      count: counts?.avatars,
    },
    {
      title: 'Reports',
      description: 'Review and manage reports submitted by users.',
      path: '/admin/reports',
      count: counts?.reports,
    },
    {
      title: 'Categories',
      description: 'Create, edit and manage creative categories.',
      path: '/admin/categories',
      count: null,
    },
  ]

  return (
    <main className="bg-admin-bg min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-admin-muted mt-1 text-sm">
            CreAtlantis administration overview.
          </p>
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className="border-admin-border bg-admin-bg rounded-xl border p-6 transition hover:border-blue-500"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">{section.title}</h2>

                {section.count !== null && (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-400">
                    {loading ? '...' : (section.count ?? '—')}
                  </span>
                )}
              </div>

              <p className="text-admin-muted mt-2 text-sm">
                {section.description}
              </p>

              <p className="mt-4 text-sm font-medium text-blue-400">
                Open section →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
