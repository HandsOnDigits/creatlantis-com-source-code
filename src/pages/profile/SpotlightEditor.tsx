import type { Dispatch, SetStateAction } from 'react'

import PostSelectorOverlay from '../../components/PostSelectorOverlay'

import { postsApi, type Post } from '../../api'

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
  if (!editingSpotlightId) {
    return null
  }

  return (
    <>
      <section className="mx-auto mb-6 max-w-4xl rounded border border-current/20 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Edit Spotlight</h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-current/20 px-3 py-1 text-sm hover:bg-current/5"
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
          className="w-full rounded border border-current/20 bg-transparent p-2"
        />

        <div className="mt-6 flex flex-col gap-3">
          <div>
            <h3 className="font-medium">Selected posts</h3>
            <p className="text-sm opacity-60">
              {selectedPosts.length} of 20 posts selected
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSelectorOpenChange(true)}
            className="w-fit rounded border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
          >
            Select posts
          </button>

          {selectedPosts.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {selectedPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 rounded border border-current/10 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {post.title || 'Untitled post'}
                    </p>
                    <p className="text-xs opacity-50">Position {index + 1}</p>
                  </div>

                  <button
                    type="button"
                    disabled={index === 0 || saving}
                    onClick={() => {
                      onSelectedPostsChange((current) => {
                        const updated = [...current]
                        ;[updated[index - 1], updated[index]] = [
                          updated[index],
                          updated[index - 1],
                        ]
                        return updated
                      })
                    }}
                    className="rounded border border-current/20 px-3 py-1 disabled:opacity-30"
                    aria-label={`Move ${post.title || 'post'} up`}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    disabled={index === selectedPosts.length - 1 || saving}
                    onClick={() => {
                      onSelectedPostsChange((current) => {
                        const updated = [...current]
                        ;[updated[index], updated[index + 1]] = [
                          updated[index + 1],
                          updated[index],
                        ]
                        return updated
                      })
                    }}
                    className="rounded border border-current/20 px-3 py-1 disabled:opacity-30"
                    aria-label={`Move ${post.title || 'post'} down`}
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          )}
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
            {saving ? 'Saving...' : 'Save Spotlight'}
          </button>
        </div>
      </section>

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
