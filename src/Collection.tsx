import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Journal, Image } from './PostElements'
import { HorizontalHR } from './Utilites'
import { categoriesApi, postsApi, type Category, type Post } from './api'

function Collection() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  )

  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load categories.
  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const response = await categoriesApi.list()

        if (!cancelled) {
          setCategories(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load categories.',
          )
        }
      }
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  // Load posts, optionally filtered by category.
  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      try {
        setLoading(true)
        setError(null)

        const response = await postsApi.list(
          1,
          50,
          selectedCategoryId ?? undefined,
        )

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
  }, [selectedCategoryId])

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  )

  const heading = selectedCategory
    ? `${selectedCategory.name} Posts`
    : 'All Posts'

  return (
    <div className="flex min-h-screen">
      {/* Category Selection */}
      <ol
        id="category-list"
        className="w-[18vw] space-y-2 p-4 text-nowrap lg:w-[8vw]"
      >
        <li
          className={`cursor-pointer transition-colors ${
            selectedCategoryId === null ? 'selected-index' : ''
          }`}
          onClick={() => setSelectedCategoryId(null)}
        >
          All
        </li>

        {categories.map((category) => (
          <li
            key={category.id}
            className={`cursor-pointer transition-colors ${
              selectedCategoryId === category.id ? 'selected-index' : ''
            }`}
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.name}
          </li>
        ))}
      </ol>

      {/* Collection Display */}
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <h2 className="big-text font-bold">{heading}</h2>

        <HorizontalHR />

        <div className="h-[90vh] scrollbar-none overflow-y-auto">
          {loading && <p className="p-4">Loading posts...</p>}

          {error && <p className="p-4 text-red-500">{error}</p>}

          {!loading && !error && posts.length === 0 && (
            <p className="p-4">No posts available.</p>
          )}

          {/* Masonry Layout */}
          {!loading && !error && (
            <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="cursor-pointer break-inside-avoid"
                >
                  <Link to={`/posts/${post.id}`} className="block">
                    <h3 className="mb-2 font-semibold">{post.title}</h3>

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
