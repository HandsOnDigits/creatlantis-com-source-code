import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { HorizontalHR, ProfileIcon } from '../Utilites'

import { postsApi, type Post as PostData, type PostImageVariant } from '../api'

import { Image, Journal } from '../PostElements'

const MIN_ZOOM = 1
const MAX_ZOOM = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getLargestImage(variants: PostImageVariant[]) {
  const largest = [...variants].sort((a, b) => b.width - a.width)

  if (largest.length === 0) return null

  const maxWidth = largest[0].width

  return (
    largest.find(
      (variant) => variant.width === maxWidth && variant.format === 'AVIF',
    ) ??
    largest.find(
      (variant) => variant.width === maxWidth && variant.format === 'WEBP',
    ) ??
    largest[0]
  )
}

function Post() {
  const { id } = useParams<{ id: string }>()

  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Image viewer state
  const [selectedImage, setSelectedImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Pointer tracking for dragging and pinch zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const dragStart = useRef({
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
  })

  const pinchStart = useRef({
    distance: 0,
    zoom: 1,
  })

  // Load post
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

  // Reset viewer
  function closeViewer() {
    setSelectedImage(null)
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
    pointers.current.clear()
  }

  // Open viewer
  function openViewer(src: string, alt: string) {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
    pointers.current.clear()

    setSelectedImage({ src, alt })
  }

  // Prevent background scrolling and handle Escape
  useEffect(() => {
    if (!selectedImage) return

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeViewer()
      }

      if (event.key === '+' || event.key === '=') {
        setZoom((current) => clamp(current + 0.5, MIN_ZOOM, MAX_ZOOM))
      }

      if (event.key === '-') {
        setZoom((current) => clamp(current - 0.5, MIN_ZOOM, MAX_ZOOM))
      }

      if (event.key === '0') {
        setZoom(MIN_ZOOM)
        setOffset({ x: 0, y: 0 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedImage])

  // Zoom controls
  function changeZoom(amount: number) {
    setZoom((current) => clamp(current + amount, MIN_ZOOM, MAX_ZOOM))
  }

  function resetZoom() {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }

  // Calculate distance between two touch pointers
  function getPointerDistance() {
    const points = Array.from(pointers.current.values())

    if (points.length < 2) return 0

    const dx = points[0].x - points[1].x
    const dy = points[0].y - points[1].y

    return Math.sqrt(dx * dx + dy * dy)
  }

  // Pointer down: start dragging or pinching
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    if (pointers.current.size === 2) {
      pinchStart.current = {
        distance: getPointerDistance(),
        zoom,
      }
    } else if (zoom > 1) {
      dragStart.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      }
    }
  }

  // Pointer move: drag or pinch zoom
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    if (pointers.current.size >= 2) {
      const distance = getPointerDistance()
      const start = pinchStart.current

      if (start.distance > 0) {
        setZoom(
          clamp(start.zoom * (distance / start.distance), MIN_ZOOM, MAX_ZOOM),
        )
      }

      return
    }

    if (zoom > 1) {
      setOffset({
        x: dragStart.current.offsetX + event.clientX - dragStart.current.x,
        y: dragStart.current.offsetY + event.clientY - dragStart.current.y,
      })
    }
  }

  // Pointer up: finish gesture
  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)

    if (pointers.current.size === 1) {
      const remaining = Array.from(pointers.current.values())[0]

      dragStart.current = {
        x: remaining.x,
        y: remaining.y,
        offsetX: offset.x,
        offsetY: offset.y,
      }
    }
  }

  // Mouse wheel zoom
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()

    const amount = event.deltaY < 0 ? 0.25 : -0.25

    changeZoom(amount)
  }

  // Double click / double tap zoom
  function handleDoubleClick() {
    if (zoom > 1) {
      resetZoom()
    } else {
      setZoom(2.5)
    }
  }

  if (loading) {
    return <div className="p-8">Loading post...</div>
  }

  if (error || !post) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="error-feedback">{error ?? 'Post not found.'}</p>

        <Link to="/" className="mt-4 inline-block underline">
          Back to collection
        </Link>
      </main>
    )
  }

  let name = post.author
    ? (post.author.name ?? post.author.username)
    : 'Unknown author'

  return (
    <>
      <main className="flex min-h-screen flex-col p-6">
        {/* Back Navigation */}
        <Link
          to="/"
          className="mb-6 inline-block transition-opacity hover:opacity-60"
        >
          ← Back to collection
        </Link>

        {/* Post Header */}
        <header>
          <h1 className="big-text font-bold">{post.title}</h1>

          <div className="mt-3 flex flex-wrap gap-3 text-sm opacity-60">
            {post.author && <span>By {name}</span>}

            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
          </div>

          <HorizontalHR />

          {post.author && (
            <Link
              to={'/profile/' + post.author.username}
              className="mt-4 inline-block underline"
            >
              <ProfileIcon name={name} image={post.author.avatarUrl} />
            </Link>
          )}
        </header>

        {/* Post Content */}
        <section className="">
          {post.type === 'IMAGE' && (
            <div className="flex w-full flex-col items-center gap-4">
              {(post.images ?? []).map((media) => {
                const largest = getLargestImage(media.variants)

                return (
                  <Image
                    key={media.id}
                    variants={media.variants}
                    alt={post.title}
                    onClick={
                      largest
                        ? () => openViewer(largest.url, post.title)
                        : undefined
                    }
                  />
                )
              })}
            </div>
          )}

          {post.type === 'JOURNAL' && post.content && (
            <Journal content={post.content} />
          )}

          {/* Metadata */}
          <div className="bg-background-blend flex flex-col items-center pb-4">
            <HorizontalHR />

            {post.content && post.type !== 'JOURNAL' && (
              <p className="mb-8 leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
            )}

            {post.type === 'MODEL' && <p>Model posts are not available yet.</p>}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/?tag=${encodeURIComponent(tag.name)}`}
                    className="border-style bg-background-blend px-3 py-1"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Fullscreen Image Viewer */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image zoom viewer"
          className="fixed inset-0 z-9999 flex flex-col bg-black"
        >
          {/* Toolbar */}
          <div className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between gap-3 bg-linear-to-b from-black/80 to-transparent p-4 text-white">
            <span className="max-w-[40%] truncate text-sm opacity-80">
              {selectedImage.alt}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeZoom(-0.5)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl transition-colors hover:bg-white/20 disabled:opacity-30"
              >
                −
              </button>

              <button
                type="button"
                onClick={resetZoom}
                aria-label="Reset zoom"
                className="min-w-16 rounded-full bg-white/10 px-3 py-2 text-sm transition-colors hover:bg-white/20"
              >
                {Math.round(zoom * 100)}%
              </button>

              <button
                type="button"
                onClick={() => changeZoom(0.5)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl transition-colors hover:bg-white/20 disabled:opacity-30"
              >
                +
              </button>

              <button
                type="button"
                onClick={closeViewer}
                aria-label="Close image viewer"
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl transition-colors hover:bg-white/20"
              >
                ×
              </button>
            </div>
          </div>

          {/* Image Interaction Area */}
          <div
            className="flex h-full w-full touch-none items-center justify-center overflow-hidden select-none"
            style={{
              cursor: zoom > 1 ? 'grab' : 'zoom-in',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
          >
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              draggable={false}
              loading="eager"
              decoding="async"
              className="max-h-full max-w-full object-contain"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition:
                  pointers.current.size > 0
                    ? 'none'
                    : 'transform 150ms ease-out',
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            />
          </div>

          {/* Instructions */}
          <div className="pointer-events-none absolute right-0 bottom-5 left-0 text-center text-xs text-white/50">
            Scroll or pinch to zoom · Drag to move · Double-click to toggle zoom
            · ESC to close
          </div>
        </div>
      )}
    </>
  )
}

export default Post
