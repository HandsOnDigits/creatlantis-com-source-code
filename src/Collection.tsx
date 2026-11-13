import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Journal, Image } from './PostElements'
import { HorizontalHR } from './Utilites'
import { postsApi, type Post, type PostType } from './api'

const categoryNames = {
  ALL: 'All',
  IMAGE: 'Images',
  JOURNAL: 'Journals',
  MODEL: 'Models',
} as const

type Category = keyof typeof categoryNames

function Collection() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('ALL')

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      try {
        setLoading(true)
        setError(null)

        const response = await postsApi.list(1, 50)

        if (!cancelled) {
          setPosts(response.data)
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

    loadPosts()

    return () => {
      cancelled = true
    }
  }, [])

  const categories = Object.keys(categoryNames) as Category[]

  const filteredPosts =
    selectedCategory === 'ALL'
      ? posts
      : posts.filter((post) => post.type === (selectedCategory as PostType))

  return (
    <div className="flex min-h-screen">
      {/* Category Selection */}
      <ol
        id="category-list"
        className="w-[18vw] space-y-2 p-4 text-nowrap lg:w-[8vw]"
      >
        {categories.map((category) => (
          <li
            key={category}
            className={`transition-colors ${
              selectedCategory === category ? 'selected-index' : ''
            }`}
            onClick={() => setSelectedCategory(category)}
            style={{ cursor: 'pointer' }}
          >
            {categoryNames[category]}
          </li>
        ))}
      </ol>

      {/* Collection Display */}
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <h2 className="big-text font-bold">
          {categoryNames[selectedCategory]} Posts
        </h2>

        <HorizontalHR />

        <div className="h-[90vh] scrollbar-none overflow-y-auto">
          {loading && <p className="p-4">Loading posts...</p>}

          {error && <p className="p-4 text-red-500">{error}</p>}

          {!loading && !error && filteredPosts.length === 0 && (
            <p className="p-4">No posts available.</p>
          )}

          {/* Masonry Layout */}
          {!loading && !error && (
            <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
              {filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="cursor-pointer break-inside-avoid"
                >
                  <Link to={`/posts/${post.id}`} className="block">
                    <h3 className="mb-2 font-semibold">{post.title}</h3>

                    {/* Image Posts */}
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

                    {/* Journal Posts */}
                    {post.type === 'JOURNAL' && (
                      <Journal content={post.content ?? ''} />
                    )}

                    {/* Model Posts */}
                    {post.type === 'MODEL' && (
                      <p>Model posts are not available yet.</p>
                    )}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Collection
