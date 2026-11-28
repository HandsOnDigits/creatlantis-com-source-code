import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  categoriesApi,
  postsApi,
  type Category,
  type EditablePost,
} from '../api'

import { VerticalHR } from '../Utilites'

function EditPost() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const postId = Number(id)

  const [post, setPost] = useState<EditablePost | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categorySearch, setCategorySearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadPost() {
      if (!Number.isSafeInteger(postId) || postId <= 0) {
        setError('Invalid post ID.')
        setLoading(false)
        return
      }

      try {
        const [postResponse, categoryResponse] = await Promise.all([
          postsApi.getForEdit(postId),
          categoriesApi.list(),
        ])

        if (cancelled) return

        const loadedPost = postResponse.data

        setPost(loadedPost)
        setCategories(categoryResponse.data)
        setTitle(loadedPost.title)
        setContent(loadedPost.content ?? '')
        setTagsInput(loadedPost.tags?.map((tag) => tag.name).join(', ') ?? '')
        setSelectedCategoryIds(
          loadedPost.categories.map((category) => category.id),
        )
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
  }, [postId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!post) return

    setError('')
    setStatus('')
    setSaving(true)

    try {
      await postsApi.update(post.id, {
        title,
        content: content || null,
        tags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        categoryIds: selectedCategoryIds,
      })

      setStatus('Post updated successfully.')
      navigate(`/posts/pending`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p>Loading post...</p>
  }

  if (!post) {
    return (
      <div className="bg-background-blend p-8">
        <p role="alert">{error || 'Post not found.'}</p>
        <Link to="/">Return home</Link>
      </div>
    )
  }

  return (
    <div className="bg-background-blend">
      <form onSubmit={handleSubmit} className="p-0">
        <h1 className="big-text">Edit {post.type.toLowerCase()} post</h1>

        <div className="flex flex-col items-center justify-center self-center p-8 lg:w-200">
          <div>
            <div className="submit-input justify-center">
              <div className="flex items-center gap-4">
                <label htmlFor="post-title">Title</label>
                <input
                  id="post-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  maxLength={200}
                />
              </div>
            </div>

            <div className="submit-input item flex-col">
              <label htmlFor="post-content">Description</label>
              <textarea
                id="post-content"
                className="h-50 w-[90vw]"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required={post.type === 'JOURNAL'}
                maxLength={50000}
              />
            </div>
          </div>

          <div className="submit-input item flex-col">
            <h2>Categories</h2>

            <input
              type="search"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
            />

            <div className="max-h-64 overflow-y-auto rounded-lg border p-3">
              {categories
                .filter((category) =>
                  category.name
                    .toLowerCase()
                    .includes(categorySearch.toLowerCase()),
                )
                .map((category) => (
                  <label
                    key={category.id}
                    className="flex cursor-pointer items-start gap-3 p-2"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(category.id)}
                      onChange={(event) => {
                        setSelectedCategoryIds((current) =>
                          event.target.checked
                            ? [...current, category.id]
                            : current.filter((id) => id !== category.id),
                        )
                      }}
                    />

                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm opacity-70">
                        {category.description || 'No description available.'}
                      </p>
                    </div>
                  </label>
                ))}

              {categories.length > 0 &&
                categories.filter((category) =>
                  category.name
                    .toLowerCase()
                    .includes(categorySearch.toLowerCase()),
                ).length === 0 && <p>No matching categories.</p>}
            </div>
          </div>

          <div className="submit-input item flex-col">
            <label htmlFor="post-tags">Tags</label>
            <input
              id="post-tags"
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="digital-art, 3d, photography"
            />
            <p className="text-sm opacity-70">
              Separate tags with commas. Maximum 20 tags, 30 characters each.
            </p>
          </div>
        </div>

        <div className="light-to-dark-gradient flex items-center justify-center">
          <VerticalHR />

          <button type="submit" disabled={saving} className="submit">
            {saving ? 'Saving...' : 'Save'}
          </button>

          <Link to={`/posts/${post.id}`}>
            <button className="cancel">Cancel</button>
          </Link>

          <VerticalHR />
        </div>
      </form>

      {status && <p>{status}</p>}
      {error && (
        <p role="alert" id="error-feedback">
          {error}
        </p>
      )}
    </div>
  )
}

export default EditPost
