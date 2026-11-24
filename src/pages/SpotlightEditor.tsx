import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'

import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { CSS } from '@dnd-kit/utilities'

import { postsApi, profilesApi, type Post, type ProfileLayout } from '../api'

import { useAuth } from '../AuthContext'
import PostSelectorOverlay from '../components/PostSelectorOverlay'

interface SortableSpotlightPostProps {
  post: Post
  index: number
}

function SortableSpotlightPost({ post, index }: SortableSpotlightPostProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 rounded-lg border border-current/15 p-3 ${
        isDragging ? 'z-10 opacity-50 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded px-2 py-2 text-xl opacity-60 hover:bg-current/5 active:cursor-grabbing"
        aria-label={`Drag to reorder ${post.title}`}
        title="Drag to reorder"
      >
        ⠿
      </button>

      <span className="w-6 text-center text-sm opacity-50">{index + 1}</span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{post.title}</p>
        <p className="text-xs opacity-50">
          {post.type} · {new Date(post.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}

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
  const [selectedPosts, setSelectedPosts] = useState<Post[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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

        const postIds = widget.config?.postIds ?? []

        setLayout(currentLayout)
        setSelectedPostIds(postIds)

        if (postIds.length > 0) {
          await loadSelectedPosts(postIds)
        }
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

  async function loadSelectedPosts(postIds: number[]) {
    const posts = await Promise.all(
      postIds.map(async (id) => {
        const response = await postsApi.get(id)
        return response.data
      }),
    )

    setSelectedPosts(posts)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    setSelectedPostIds((currentIds) => {
      const oldIndex = currentIds.indexOf(Number(active.id))
      const newIndex = currentIds.indexOf(Number(over.id))

      if (oldIndex === -1 || newIndex === -1) return currentIds

      return arrayMove(currentIds, oldIndex, newIndex)
    })

    setSelectedPosts((currentPosts) => {
      const oldIndex = currentPosts.findIndex(
        (post) => post.id === Number(active.id),
      )
      const newIndex = currentPosts.findIndex(
        (post) => post.id === Number(over.id),
      )

      if (oldIndex === -1 || newIndex === -1) return currentPosts

      return arrayMove(currentPosts, oldIndex, newIndex)
    })
  }

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

          {selectedPosts.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold">Spotlight order</h2>

              <p className="mb-3 text-xs opacity-50">
                Drag posts using the handle to change their display order.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedPosts.map((post) => post.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {selectedPosts.map((post, index) => (
                      <SortableSpotlightPost
                        key={post.id}
                        post={post}
                        index={index}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

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
            void loadSelectedPosts(postIds).catch((err) => {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Failed to load selected posts.',
              )
            })
            setSelectorOpen(false)
          }}
          onClose={() => setSelectorOpen(false)}
        />
      )}
    </main>
  )
}

export default SpotlightEditor
