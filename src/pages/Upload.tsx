import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { mediaApi, postsApi, type PostType as ApiPostType } from '../api'

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
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const uploadController = useRef<AbortController | null>(null)
  const [cancelling, setCancelling] = useState(false)

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
        content: content || null,
        mediaIds,
      })

      setStatus('Post created successfully.')
      setTitle('')
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
    <div>
      <h2>Create {postTypeLabels[postType]}</h2>

      <form onSubmit={handleSubmit}>
        <div>
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

        <div>
          <label htmlFor="post-content">
            {postType === PostType.Journal ? 'Journal entry' : 'Description'}
          </label>

          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required={postType === PostType.Journal}
            maxLength={50000}
          />
        </div>

        {postType === PostType.Image && (
          <div>
            <label htmlFor="post-file">Image</label>
            <input
              id="post-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create post'}
        </button>
        {status === 'Image status: UPLOADING' && (
          <button
            type="button"
            onClick={handleCancelUpload}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel upload'}
          </button>
        )}
      </form>

      {status && <p>{status}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default Upload
