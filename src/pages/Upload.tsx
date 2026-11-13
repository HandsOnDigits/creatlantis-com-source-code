import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { mediaApi, postsApi, type PostType as ApiPostType } from '../api'

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
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const uploadController = useRef<AbortController | null>(null)
  const [cancelling, setCancelling] = useState(false)

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
    </div>
  )
}

export default Upload
