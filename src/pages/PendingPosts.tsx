import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postsApi, type Post } from '../api'

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
    <main className="bg-background-blend min-h-screen p-8">
      <h1 className="big-text">Pending posts</h1>
      <p className="mb-6">
        These posts are waiting for administrator approval. You can edit them
        while they are pending.
      </p>

      {loading && <p>Loading pending posts...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <p>You have no posts waiting for approval.</p>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <article key={post.id} className="border border-current/20 p-4">
            <h2 className="text-xl font-semibold">{post.title}</h2>

            <p className="text-sm opacity-70">
              {post.type} · {new Date(post.createdAt).toLocaleDateString()}
            </p>

            <Link
              to={`/posts/${post.id}/edit`}
              className="mt-3 inline-block underline hover:opacity-60"
            >
              Edit post
            </Link>
          </article>
        ))}
      </div>
    </main>
  )
}

export default PendingPosts
