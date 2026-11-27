import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { CollectionType, CollectionSort } from './SearchAndFilter'

import { Journal, Image } from './PostElements'
import { HorizontalHR } from './Utilites'
import {
  categoriesApi,
  postsApi,
  usersApi,
  type Category,
  type Post,
  type UserDirectoryEntry,
} from './api'

interface CollectionProps {
  collectionType: CollectionType
  search: string
  sort: CollectionSort
}

function Collection({ collectionType, search, sort }: CollectionProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlTag = searchParams.get('tag')?.trim().toLowerCase() ?? ''

  const searchTags = search
    .split(/\s+/)
    .filter((part) => part.startsWith('#'))
    .map((tag) => tag.slice(1).toLowerCase())
    .filter(Boolean)

  const selectedTags = urlTag ? [urlTag] : searchTags
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  )

  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [users, setUsers] = useState<UserDirectoryEntry[]>([])
  const [, setUsersHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load categories.
  useEffect(() => {
    if (collectionType !== 'posts') return

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
  }, [collectionType])

  // Load posts, optionally filtered by category.
  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      if (collectionType !== 'posts') return

      try {
        setLoading(true)
        setError(null)

        const response = await postsApi.list(
          1,
          50,
          selectedCategoryId ?? undefined,
          sort,
          search.replace(/(?:^|\s)#[^\s]+/g, ' ').trim() || undefined,
          selectedTags.length > 0 ? selectedTags.join(',') : undefined,
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
  }, [selectedCategoryId, collectionType, search, sort, selectedTags.join(',')])

  // Load public users.
  useEffect(() => {
    if (collectionType !== 'users') return

    let cancelled = false

    async function loadUsers() {
      try {
        setLoading(true)
        setError(null)

        const response = await usersApi.directory(1, 24, sort, search)

        if (!cancelled) {
          setUsers(response.data)
          setUsersHasMore(response.pagination.hasMore)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load users.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadUsers()

    return () => {
      cancelled = true
    }
  }, [
    collectionType,
    search.replace(/(?:^|\s)#[^\s]+/g, ' ').trim() || undefined,
    sort,
  ])

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  )

  const heading =
    collectionType === 'users'
      ? 'Users'
      : selectedTags.length > 0
        ? `${selectedTags.map((tag) => `#${tag}`).join(' ')} Posts`
        : selectedCategory
          ? `${selectedCategory.name} Posts`
          : 'All Posts'

  return (
    <div className="flex min-h-screen">
      {/* Category Selection */}
      {collectionType === 'posts' && (
        <ol
          id="category-list"
          className="w-[18vw] space-y-2 p-4 text-nowrap lg:w-[8vw]"
        >
          <li
            className={`cursor-pointer transition-colors ${
              selectedCategoryId === null ? 'selected-index' : ''
            }`}
            onClick={() => {
              setSelectedCategoryId(null)
              setSearchParams((params) => {
                params.delete('tag')
                return params
              })
            }}
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
      )}

      {/* Collection Display */}
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <h2 className="big-text font-bold">{heading}</h2>

        <HorizontalHR />

        <div className="h-[90vh] scrollbar-none overflow-y-auto">
          {loading && <p className="p-4">Loading posts...</p>}

          {error && <p className="error-feedback p-4">{error}</p>}

          {!loading &&
            !error &&
            ((collectionType === 'posts' && posts.length === 0) ||
              (collectionType === 'users' && users.length === 0)) && (
              <p className="p-4">
                {collectionType === 'users'
                  ? 'No users found.'
                  : 'No posts available.'}
              </p>
            )}

          {/* Masonry Layout */}
          {!loading && !error && collectionType === 'posts' && (
            <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:block lg:columns-[500px]">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="mb-3 w-full max-w-150 cursor-pointer overflow-hidden lg:break-inside-avoid"
                >
                  <Link to={`/posts/${post.id}`} className="block">
                    <h3
                      className="mb-2 truncate font-semibold"
                      title={post.title}
                    >
                      {post.title}
                    </h3>

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

          {!loading && !error && collectionType === 'users' && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => (
                <Link
                  key={user.id}
                  to={`/profile/${encodeURIComponent(user.username)}`}
                  className="flex items-center gap-4"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-16 w-16" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="font-semibold">{user.username}</h3>
                    {user.name && <p>{user.name}</p>}
                    {user.tagline && <p className="truncate">{user.tagline}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Collection
