import { Link } from 'react-router-dom'
import { Image, Journal } from '../../PostElements'
import type { Post } from '../../api'

interface ContentTabProps {
  posts: Post[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

function ContentTab({ posts, loading, hasMore, onLoadMore }: ContentTabProps) {
  const imagePosts = posts.filter((post) => post.type === 'IMAGE')
  const journalPosts = posts.filter((post) => post.type === 'JOURNAL')

  if (loading && posts.length === 0) {
    return <p className="text-sm opacity-60">Loading content...</p>
  }

  if (posts.length === 0) {
    return <p className="text-sm opacity-60">No published content yet.</p>
  }

  return (
    <div className="flex flex-col gap-12">
      {/* Images */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Images</h2>

        {imagePosts.length === 0 ? (
          <p className="text-sm opacity-60">No images published yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {imagePosts.map((post) => {
              const firstImage = post.images?.[0]

              if (!firstImage || firstImage.variants.length === 0) {
                return null
              }

              return (
                <Link
                  key={post.id}
                  to={`/posts/${post.id}`}
                  className="group block overflow-hidden rounded border border-current/10"
                >
                  <Image
                    variants={firstImage.variants}
                    alt={post.title}
                    className="transition-transform duration-300 group-hover:scale-105"
                  />

                  <div className="p-2">
                    <p className="truncate text-sm font-medium">{post.title}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Journals */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Journals</h2>

        {journalPosts.length === 0 ? (
          <p className="text-sm opacity-60">
            No journal entries published yet.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {journalPosts.map((post) => (
              <article
                key={post.id}
                className="rounded border border-current/10 p-4"
              >
                <header className="mb-3">
                  <Link
                    to={`/posts/${post.id}`}
                    className="text-lg font-bold transition-opacity hover:opacity-60"
                  >
                    {post.title}
                  </Link>

                  <p className="mt-1 text-xs opacity-50">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </header>

                {post.content && <Journal content={post.content} />}

                <Link
                  to={`/posts/${post.id}`}
                  className="mt-3 inline-block text-sm underline transition-opacity hover:opacity-60"
                >
                  Read journal
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="self-start rounded border border-current/20 px-4 py-2 text-sm transition-opacity hover:opacity-60 disabled:opacity-40"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

export default ContentTab
