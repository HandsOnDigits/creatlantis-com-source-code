import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { profilesApi, type ProfileLayout } from '../api'

import { useAuth } from '../AuthContext'
import PostSelectorOverlay from '../components/PostSelectorOverlay'

function SpotlightEditor() {
  const { widgetId } = useParams<{ widgetId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [layout, setLayout] = useState<ProfileLayout | null>(null)
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (!user?.username || !widgetId) {
        setError('Unable to identify the profile or Spotlight widget.')
        setLoading(false)
        return
      }

      try {
        const layoutResponse = await profilesApi.getMyLayout()

        if (cancelled) return

        const currentLayout = layoutResponse.data.layout

        const widget = currentLayout.columns
          .flatMap((column) => column.widgets)
          .find((item) => item.id === widgetId)

        if (!widget || widget.type !== 'featured') {
          setError('Spotlight widget not found.')
          return
        }

        setLayout(currentLayout)
        setSelectedPostIds(widget.config?.postIds ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load Spotlight.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [user?.username, widgetId])

  async function handleSave() {
    if (!layout || !widgetId || !user?.username) return

    setSaving(true)
    setError(null)

    try {
      const updatedLayout: ProfileLayout = {
        ...layout,
        columns: layout.columns.map((column) => ({
          ...column,
          widgets: column.widgets.map((widget) =>
            widget.id === widgetId
              ? {
                  ...widget,
                  config: {
                    ...widget.config,
                    postIds: selectedPostIds,
                  },
                }
              : widget,
          ),
        })),
      }

      await profilesApi.updateMyLayout(updatedLayout)

      navigate(`/profile/${encodeURIComponent(user.username)}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save Spotlight posts.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Link
          to={`/profile/${user?.username ?? ''}`}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← Back to profile
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Select Spotlight posts</h1>

        <p className="mt-2 text-sm opacity-60">
          Choose up to 20 posts to display in this Spotlight widget.
        </p>
      </div>

      {loading && <p>Loading Spotlight...</p>}

      {error && <p className="error-feedback">{error}</p>}

      {!loading && !error && (
        <>
          <div className="flex flex-col gap-4">
            <p className="text-sm opacity-60">
              {selectedPostIds.length} of 20 posts selected
            </p>

            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="w-fit rounded border border-current/20 px-4 py-2 text-sm transition-colors hover:bg-current/5"
            >
              Select posts
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(`/profile/${encodeURIComponent(user?.username ?? '')}`)
              }
              disabled={saving}
              className="rounded border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !layout}
              className="text-background rounded bg-current px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save selection'}
            </button>
          </div>
        </>
      )}

      {selectorOpen && user?.username && (
        <PostSelectorOverlay
          username={user.username}
          selectedPostIds={selectedPostIds}
          maxSelections={20}
          onConfirm={(postIds) => {
            setSelectedPostIds(postIds)
            setSelectorOpen(false)
          }}
          onClose={() => setSelectorOpen(false)}
        />
      )}
    </main>
  )
}

export default SpotlightEditor
