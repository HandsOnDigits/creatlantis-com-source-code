import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  categoriesApi,
  mediaApi,
  postsApi,
  type Category,
  type PostType as ApiPostType,
} from '../api'

import { VerticalHR } from '../Utilites'

/* Images */
import upload_icon from '../assets/images/icons/uploadIcon.webp'

export enum PostType {
  Image = 'image',
  Journal = 'journal',
  Model = 'model',
}

const postTypeLabels: Record<PostType, string> = {
  [PostType.Image]: 'Image',
  [PostType.Journal]: 'Journal',
  [PostType.Model]: '3D Model',
}

const apiPostTypes: Record<PostType, ApiPostType> = {
  [PostType.Image]: 'IMAGE',
  [PostType.Journal]: 'JOURNAL',
  [PostType.Model]: 'MODEL',
}

function isPostType(value: string | undefined): value is PostType {
  return Object.values(PostType).includes(value as PostType)
}

function Upload() {
  const { type } = useParams<{ type: string }>()

  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySearch, setCategorySearch] = useState('')

  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const uploadController = useRef<AbortController | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const [showSuccessPopup, setShowSuccessPopup] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Free up memory when the file changes or component unmounts
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

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
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false)
        }
      }
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  if (!isPostType(type) || type === PostType.Model) {
    return <div>Post type is unavailable.</div>
  }

  const postType = type

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setStatus('')
    setLoading(true)

    const controller = new AbortController()
    uploadController.current = controller

    try {
      let mediaIds: string[] = []

      if (postType === PostType.Image) {
        if (!file) {
          throw new Error('Please select an image.')
        }

        setStatus('Uploading image...')

        const media = await mediaApi.upload(file, {
          waitForProcessing: true,
          signal: controller.signal,
          onStatusChange: (stage) => {
            setStatus(`Image status: ${stage}`)
          },
        })

        mediaIds = [media.id]
      }

      setStatus('Creating post...')

      await postsApi.create({
        type: apiPostTypes[postType],
        title,
        tags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        categoryIds: selectedCategoryIds,
        content: content || null,
        mediaIds,
      })

      setStatus('Post created successfully.')
      setShowSuccessPopup(true)

      setTitle('')
      setTagsInput('')
      setSelectedCategoryIds([])
      setContent('')
      setFile(null)

      const fileInput = document.getElementById(
        'post-file',
      ) as HTMLInputElement | null

      if (fileInput) fileInput.value = ''
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('Upload cancelled.')
        setError('')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create post.')
      }
    } finally {
      uploadController.current = null
      setCancelling(false)
      setLoading(false)
    }
  }

  function handleCancelUpload() {
    const controller = uploadController.current

    if (!controller || controller.signal.aborted) return

    setCancelling(true)
    controller.abort()
  }

  return (
    <div className="bg-background-blend">
      <form onSubmit={handleSubmit} className="p-0">
        <h1 className="big-text">Create {postTypeLabels[postType]}</h1>

        <div className="flex flex-col items-center justify-center self-center p-8 lg:w-200">
          {/* Text inputs */}
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
              <label htmlFor="post-content">
                {postType === PostType.Journal
                  ? 'Journal entry'
                  : 'Description'}
              </label>

              <textarea
                id="post-content"
                className="h-50 w-[90vw]"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required={postType === PostType.Journal}
                maxLength={50000}
              />
            </div>
          </div>

          {/* Category selection */}
          <div className="submit-input item flex-col">
            <h2>Categories</h2>

            <input
              type="search"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
            />

            {categoriesLoading ? (
              <p>Loading categories...</p>
            ) : (
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
            )}
          </div>

          {/* Tag selection */}
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

          {/* File inputs */}
          {postType === PostType.Image && (
            <div className="flex w-[90vw] flex-col justify-center">
              <label className="text-center" htmlFor="post-file">
                Image
              </label>
              <input
                id="post-file"
                style={{ backgroundImage: `url(${previewUrl ?? upload_icon})` }}
                className={`h-100 w-full cursor-pointer bg-center bg-no-repeat ${
                  previewUrl ? 'bg-contain' : 'bg-auto'
                }`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="light-to-dark-gradient flex items-center justify-center gap-4">
          <VerticalHR />

          <button type="submit" disabled={loading} className="submit">
            {loading ? 'Creating...' : 'Submit'}
          </button>

          {status === 'Image status: UPLOADING' && (
            <button
              type="button"
              onClick={handleCancelUpload}
              disabled={cancelling}
              className="cancel"
            >
              {cancelling ? 'Cancelling...' : 'Cancel upload'}
            </button>
          )}

          <VerticalHR />
        </div>
      </form>

      {status && <p>{status}</p>}
      {error && (
        <p role="alert" id="error-feedback">
          {error}
        </p>
      )}

      {showSuccessPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="presentation"
        >
          <div
            className="bg-drop-down border-style flex h-1/6 w-[50wv] flex-col items-center justify-between pt-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-success-title"
          >
            <h2
              id="upload-success-title"
              className="extra-big-text mb-3 font-bold"
            >
              Upload successful!
            </h2>

            <p className="w-3/4">
              Your post has been submitted successfully and is awaiting review
              by the moderation team. You can check its approval status at any
              time.
            </p>

            <div className="light-to-dark-gradient flex justify-center gap-2">
              <VerticalHR />

              <button
                type="button"
                className="cancel"
                onClick={() => setShowSuccessPopup(false)}
              >
                Close
              </button>

              <Link
                to="/posts/pending"

                onClick={() => setShowSuccessPopup(false)}
              >
                <button className="submit">View status</button>
              </Link>

              <VerticalHR />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Upload
