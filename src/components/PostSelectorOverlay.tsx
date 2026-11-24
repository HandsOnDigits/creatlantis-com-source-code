import { useEffect, useState } from 'react'

import { postsApi, type Post } from '../api'

import { Image, Journal } from '../PostElements'

// Icon
import searchIcon from '../assets/images/icons/searchIcon.webp'

interface PostSelectorOverlayProps {
  username: string
  selectedPostIds: number[]
  maxSelections: number
  onConfirm: (postIds: number[]) => void
  onClose: () => void
}

function PostSelectorOverlay({
  username,
  selectedPostIds,
  maxSelections,
  onConfirm,
  onClose,
}: PostSelectorOverlayProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [selection, setSelection] = useState(selectedPostIds)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      setLoading(true)
      setError(null)

      try {
        const allPosts: Post[] = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          const response = await postsApi.listByUsername(
            username,
            page,
            50,
            undefined,
            search,
          )

          if (cancelled) return

          allPosts.push(...response.data)
          hasMore = response.pagination.hasMore
          page++
        }

        if (!cancelled) {
          setPosts(allPosts)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load posts.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPosts()

    return () => {
      cancelled = true
    }
  }, [username, search])

  function togglePost(postId: number) {
    setSelection((current) => {
      if (current.includes(postId)) {
        return current.filter((id) => id !== postId)
      }

      if (current.length >= maxSelections) {
        return current
      }

      return [...current, postId]
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-selector-title"
        className="bg-background bg-drop-down flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden border border-current/20"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-current/20 p-5">
          <div>
            <h2 id="post-selector-title" className="extra-big-text">
              Select posts
            </h2>
          </div>

          <button type="button" onClick={onClose} className="cancel">
            Close
          </button>
        </header>

        <div className="flex gap-4 p-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your posts..."
            maxLength={100}
            className="bg-background-blend w-full p-4"
          />
          <img src={searchIcon} className="navigation-icon" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && <p className="opacity-60">Loading posts...</p>}

          {error && <p className="error-feedback">{error}</p>}

          {!loading && !error && posts.length === 0 && (
            <p className="py-8 text-center opacity-60">
              {search
                ? 'No posts match your search.'
                : 'No approved posts available.'}
            </p>
          )}

          {!loading && !error && posts.length > 0 && (
            <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
              {posts.map((post) => {
                const isSelected = selection.includes(post.id)

                return (
                  <article
                    key={post.id}
                    className={`relative break-inside-avoid overflow-hidden rounded border transition-colors ${
                      isSelected
                        ? 'border-current bg-current/5'
                        : 'border-current/20'
                    }`}
                  >
                    <label className="bg-background/90 absolute top-3 right-3 z-10 flex cursor-pointer items-center gap-2 rounded px-3 py-2 shadow">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={
                          !isSelected && selection.length >= maxSelections
                        }
                        onChange={() => togglePost(post.id)}
                      />

                      <span className="text-xs font-medium">
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </label>

                    <div className="p-3">
                      <h3 className="mb-2 pr-24 font-semibold">{post.title}</h3>

                      {post.type === 'IMAGE' && (
                        <div className="space-y-4">
                          {(post.images ?? []).map((media) => (
                            <Image
                              key={media.id}
                              variants={media.variants}
                              alt={post.title}
                            />
                          ))}
                        </div>
                      )}

                      {post.type === 'JOURNAL' && (
                        <Journal content={post.content ?? ''} />
                      )}

                      {post.type === 'MODEL' && (
                        <p>Model posts are not available yet.</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <section className="bg-drop-down flex items-center justify-center p-4">
          <p>
            <var>
              {selection.length}/{maxSelections}
            </var>{' '}
            posts selected
          </p>

          <button type="button" onClick={onClose} className="cancel">
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm(selection)}
            disabled={loading || Boolean(error)}
            className="submit"
          >
            Confirm
          </button>
        </section>
      </section>
    </div>
  )
}

export default PostSelectorOverlay
