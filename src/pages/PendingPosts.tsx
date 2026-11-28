import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postsApi, type Post } from '../api'

import { HorizontalHR } from '../Utilites'

/* Images */
import editIcon from '../assets/images/icons/editIcon.webp'

function PendingPosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      try {
        const response = await postsApi.listMyPending()

        if (!cancelled) {
          setPosts(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load pending posts.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPosts()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="bg-background-blend min-h-screen p-4">
      <h1 className="extra-big-text">Pending posts</h1>

      <HorizontalHR />

      <p className="mb-6">
        These posts are waiting for administrator approval. You can edit them
        while they are pending.
      </p>

      {loading && <p>Loading pending posts...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <p>You have no posts waiting for approval.</p>
      )}

      <div className="bg-background-blend flex flex-col gap-4 overflow-y-scroll p-4">
        {posts.map((post) => (
          <article
            key={post.id}
            className="border-style bg-background-blend flex justify-between p-4"
          >
            <div>
              <h2 className="big-text font-semibold">{post.title}</h2>

              <p className="text-sm opacity-70">
                {post.type} · {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>

            <Link to={`/posts/${post.id}/edit`}>
              <img title={`Edit post ${post.title}`} src={editIcon} />
            </Link>
          </article>
        ))}
      </div>
    </main>
  )
}

export default PendingPosts
