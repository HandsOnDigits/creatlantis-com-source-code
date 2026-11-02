import { useState } from 'react'
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

  if (!isPostType(type) || type === PostType.Model) {
    return <div>Post type is unavailable.</div>
  }

  const postType = type

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setStatus('')
    setLoading(true)

    try {
      let mediaIds: string[] = []

      if (postType === PostType.Image) {
        if (!file) {
          throw new Error('Please select an image.')
        }

        setStatus('Uploading image...')

        const media = await mediaApi.upload(file, {
          waitForProcessing: true,
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
      setError(err instanceof Error ? err.message : 'Failed to create post.')
    } finally {
      setLoading(false)
    }
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
      </form>

      {status && <p>{status}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default Upload
