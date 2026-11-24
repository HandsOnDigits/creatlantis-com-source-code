import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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

import PostSelectorOverlay from '../../components/PostSelectorOverlay'

import { postsApi, type Post } from '../../api'

import type { Dispatch, SetStateAction } from 'react'

interface SpotlightEditorProps {
  username: string
  editingSpotlightId: string | null
  onClose: () => void
  title: string
  onTitleChange: (title: string) => void
  selectedPosts: Post[]
  onSelectedPostsChange: Dispatch<SetStateAction<Post[]>>
  selectorOpen: boolean
  onSelectorOpenChange: (open: boolean) => void
  saving: boolean
  error: string | null
  onSave: () => void
}

interface SortablePostProps {
  post: Post
  index: number
  disabled: boolean
}

function SortablePost({ post, index, disabled }: SortablePostProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: post.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="border-style bg-background-blend flex items-center gap-3 p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="cursor-grab touch-none px-2 text-xl opacity-50 select-none hover:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed"
        aria-label={`Drag to reorder ${post.title || 'post'}`}
      >
        ⠿
      </button>

      <div className="flex-1">
        <p className="truncate font-medium">{post.title || 'Untitled post'}</p>
        <p className="text-xs opacity-50">Position {index + 1}</p>
      </div>
    </div>
  )
}

function SpotlightEditor({
  username,
  editingSpotlightId,
  onClose,
  title,
  onTitleChange,
  selectedPosts,
  onSelectedPostsChange,
  selectorOpen,
  onSelectorOpenChange,
  saving,
  error,
  onSave,
}: SpotlightEditorProps) {
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = selectedPosts.findIndex(
      (post) => String(post.id) === String(active.id),
    )

    const newIndex = selectedPosts.findIndex(
      (post) => String(post.id) === String(over.id),
    )

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    onSelectedPostsChange((current) => arrayMove(current, oldIndex, newIndex))
  }

  if (!editingSpotlightId) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="spotlight-editor-title"
          className="bg-drop-down shadow-shadow-color max-h-[85vh] w-full max-w-2xl overflow-y-auto border-current/20 p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="spotlight-editor-title" className="text-xl font-bold">
              Edit Spotlight
            </h2>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cancel"
            >
              Close
            </button>
          </div>

          <label className="mb-2 block text-sm font-medium">
            Spotlight title
          </label>

          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            maxLength={160}
            placeholder="Spotlight title"
            className="bg-background-blend w-full p-2"
          />

          <div className="mt-6 flex flex-col gap-3">
            <div>
              <h3 className="font-medium">Selected posts</h3>
              <p className="text-sm opacity-60">
                {selectedPosts.length} of 20 posts selected
              </p>
              <p className="mt-1 text-xs opacity-50">
                Drag posts using the handle to change their order.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectorOpenChange(true)}
              disabled={saving}
              className="edit"
            >
              Select posts
            </button>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedPosts.map((post) => post.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="bg-background-blend flex h-120 flex-col gap-3 overflow-y-scroll p-4">
                  {selectedPosts.map((post, index) => (
                    <SortablePost
                      key={post.id}
                      post={post}
                      index={index}
                      disabled={saving}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {error && <p className="error-feedback mt-4">{error}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cancel"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="submit"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>
      </div>

      {selectorOpen && (
        <PostSelectorOverlay
          username={username}
          selectedPostIds={selectedPosts.map((post) => post.id)}
          maxSelections={20}
          onClose={() => onSelectorOpenChange(false)}
          onConfirm={async (postIds) => {
            try {
              const posts = await Promise.all(
                postIds.map(async (id) => {
                  const response = await postsApi.get(id)
                  return response.data
                }),
              )

              onSelectedPostsChange(posts)
              onSelectorOpenChange(false)
            } catch (err) {
              console.error('Failed to load selected Spotlight posts:', err)
            }
          }}
        />
      )}
    </>
  )
}

export default SpotlightEditor
