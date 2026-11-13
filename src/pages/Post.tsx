import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { postsApi, type Post as PostData } from '../api'
import { Image, Journal } from '../PostElements'

function Post() {
  const { id } = useParams<{ id: string }>()

  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPost() {
      if (!id || !/^[1-9]\d*$/.test(id)) {
        setError('Invalid post ID.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await postsApi.get(Number(id))

        if (!cancelled) {
          setPost(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load post.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPost()

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <div className="p-8">Loading post...</div>
  }

  if (error || !post) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-red-500">{error ?? 'Post not found.'}</p>

        <Link to="/" className="mt-4 inline-block underline">
          Back to collection
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Back Navigation */}
      <Link
        to="/"
        className="mb-6 inline-block transition-opacity hover:opacity-60"
      >
        ← Back to collection
      </Link>

      {/* Post Header */}
      <header className="mb-8">
        <h1 className="big-text font-bold">{post.title}</h1>

        <div className="mt-3 flex flex-wrap gap-3 text-sm opacity-60">
          {post.author && (
            <span>By {post.author.name ?? post.author.username}</span>
          )}

          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </header>

      {/* Post Content */}
      <section className="space-y-8">
        {post.type === 'IMAGE' && (
          <div className="space-y-6">
            {(post.images ?? []).map((media) => (
              <Image
                key={media.id}
                variants={media.variants}
                alt={post.title}
              />
            ))}
          </div>
        )}

        {post.type === 'JOURNAL' && post.content && (
          <Journal content={post.content} />
        )}

        {post.type === 'MODEL' && <p>Model posts are not available yet.</p>}
      </section>

      {/* Post Footer */}
      <footer className="mt-12 border-t pt-6">
        <Link to="/" className="transition-opacity hover:opacity-60">
          ← Back to collection
        </Link>
      </footer>
    </main>
  )
}

export default Post
