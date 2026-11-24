import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Image, Journal } from '../../PostElements'
import ProfileContent from './ProfileContent'

import { HorizontalHR } from '../../Utilites'

/* Icons */
import editIcon from '../../assets/images/icons/editIcon.webp'

import type {
  Post,
  PublicProfile,
  PublicProfileCustomization,
  ProfileWidget as ProfileWidgetType,
} from '../../api'

interface ProfileWidgetProps {
  widget: ProfileWidgetType
  profile: PublicProfile
  customization: PublicProfileCustomization | null

  galleryPosts: Post[]
  galleryLoading: boolean
  galleryHasMore: boolean
  onLoadMoreGallery: () => void

  spotlightPosts: Post[]
  onEditSpotlight: (widgetId: string) => void

  journalPosts: Post[]
  journalLoading: boolean
  journalHasMore: boolean
  onLoadMoreJournal: () => void

  canEditWidgets: boolean
  onUpdateWidgetConfig: (
    widgetId: string,
    field: 'title' | 'content' | 'postIds',
    value: string | number[],
  ) => Promise<void>
  savingWidgetConfig: boolean
  widgetConfigError: string | null
}

interface SpotlightCarouselProps {
  posts: Post[]
}

function SpotlightCarousel({ posts }: SpotlightCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (posts.length === 0) {
    return (
      <p className="text-sm opacity-60">No posts selected for Spotlight yet.</p>
    )
  }

  const post = posts[currentIndex]

  function changeSlide(nextIndex: number) {
    setCurrentIndex((nextIndex + posts.length) % posts.length)
  }

  const firstImage = post.images?.[0]

  return (
    <div className="flex flex-col gap-3">
      <Link to={`/posts/${post.id}`} className="block overflow-hidden rounded">
        {firstImage?.variants?.length ? (
          <Image
            variants={firstImage.variants}
            alt={post.title}
            className="max-h-125 w-full object-contain"
          />
        ) : post.type === 'JOURNAL' && post.content ? (
          <div className="rounded bg-current/5 p-4">
            <Journal content={post.content} />
          </div>
        ) : null}

        <h3 className="mt-2 text-lg font-medium">
          {post.title || 'Untitled post'}
        </h3>
      </Link>

      {posts.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => changeSlide(currentIndex - 1)}
            aria-label="Previous Spotlight post"
            className="rounded px-3 py-1 hover:bg-current/10"
          >
            ←
          </button>

          <div className="flex items-center gap-2">
            {posts.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeSlide(index)}
                aria-label={`Show Spotlight post ${index + 1}`}
                aria-current={index === currentIndex ? 'true' : undefined}
                className={`h-2 w-2 rounded-full ${
                  index === currentIndex ? 'bg-current' : 'bg-current/30'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => changeSlide(currentIndex + 1)}
            aria-label="Next Spotlight post"
            className="rounded px-3 py-1 hover:bg-current/10"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProfileWidget({
  widget,
  profile,
  customization,
  galleryPosts,
  galleryLoading,
  galleryHasMore,
  onLoadMoreGallery,
  spotlightPosts,
  onEditSpotlight,
  journalPosts,
  journalLoading,
  journalHasMore,
  onLoadMoreJournal,
  canEditWidgets,
  onUpdateWidgetConfig,
  savingWidgetConfig,
  widgetConfigError,
}: ProfileWidgetProps) {
  const [isEditing, setIsEditing] = useState(false)

  switch (widget.type) {
    case 'header':
      return (
        <header className="mb-4">
          <h1 className="big-text bg-background-blend font-bold">
            {profile.name ?? profile.username}
          </h1>

          <p className="mt-2 text-sm opacity-60">@{profile.username}</p>

          {profile.birthDate && (
            <p className="mt-2 text-sm opacity-60">
              Date of birth:{' '}
              {new Date(`${profile.birthDate}T00:00:00`).toLocaleDateString()}
            </p>
          )}
        </header>
      )

    case 'bio':
      return (
        <section className="bg-background-blend mb-6 flex flex-col items-center">
          <h2 className="mt-4 text-xl font-bold">About</h2>

          <HorizontalHR />

          <ProfileContent html={customization?.descriptionHtml ?? ''} />
        </section>
      )

    case 'gallery':
      return (
        <section className="bg-background-blend mb-6">
          <h2 className="mb-4 p-4 pb-0 text-xl font-bold">Gallery</h2>

          <HorizontalHR />

          {galleryLoading && galleryPosts.length === 0 ? (
            <p className="text-sm opacity-60">Loading gallery...</p>
          ) : galleryPosts.length === 0 ? (
            <p className="text-sm opacity-60">No artwork published yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3">
                {galleryPosts.map((post) => {
                  const firstImage = post.images?.[0]

                  if (!firstImage || firstImage.variants.length === 0) {
                    return null
                  }

                  return (
                    <Link
                      key={post.id}
                      to={`/posts/${post.id}`}
                      className="group block overflow-hidden rounded border border-current/10"
                      title={post.title}
                    >
                      <Image
                        variants={firstImage.variants}
                        alt={post.title}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />

                      <div className="truncate p-2 text-sm">{post.title}</div>
                    </Link>
                  )
                })}
              </div>

              {galleryHasMore && (
                <button
                  type="button"
                  onClick={onLoadMoreGallery}
                  disabled={galleryLoading}
                  className="mt-4 rounded border border-current/20 px-4 py-2 text-sm transition-opacity hover:opacity-60 disabled:opacity-40"
                >
                  {galleryLoading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </section>
      )

    case 'journal':
      return (
        <section className="bg-background-blend mb-6">
          <h2 className="mb-4 p-4 pb-0 text-xl font-bold">Journal</h2>

          <HorizontalHR />

          {journalLoading && journalPosts.length === 0 ? (
            <p className="text-sm opacity-60">Loading journal...</p>
          ) : journalPosts.length === 0 ? (
            <p className="text-sm opacity-60">
              No journal entries published yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-6">
                {journalPosts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded border border-current/10 p-4"
                  >
                    <header className="mb-3">
                      <Link
                        to={`/posts/${post.id}`}
                        className="text-lg font-bold transition-opacity hover:opacity-60"
                      >
                        {post.title}
                      </Link>

                      <p className="mt-1 text-xs opacity-50">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </header>

                    {post.content && <Journal content={post.content} />}

                    <Link
                      to={`/posts/${post.id}`}
                      className="mt-3 inline-block text-sm underline transition-opacity hover:opacity-60"
                    >
                      Read journal
                    </Link>
                  </article>
                ))}
              </div>

              {journalHasMore && (
                <button
                  type="button"
                  onClick={onLoadMoreJournal}
                  disabled={journalLoading}
                  className="mt-4 rounded border border-current/20 px-4 py-2 text-sm transition-opacity hover:opacity-60 disabled:opacity-40"
                >
                  {journalLoading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </section>
      )

    case 'featured': {
      const title = widget.config?.title ?? ''

      return (
        <section className="bg-background-blend mb-6">
          {canEditWidgets && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => onEditSpotlight(widget.id)}
                className="bg-background-blend"
                title="Edit Spotlight"
                aria-label="Edit Spotlight"
              >
                <img src={editIcon} />
              </button>
            </div>
          )}

          <div className="flex flex-col items-center">
            {title.trim() && (
              <h2 className="big-text font-semibold">{title}</h2>
            )}

            <HorizontalHR />
          </div>

          <SpotlightCarousel
            posts={(widget.config?.postIds ?? [])
              .map((id) => spotlightPosts.find((post) => post.id === id))
              .filter((post): post is Post => post !== undefined)}
          />
        </section>
      )
    }

    case 'customText':
      return (
        <section className="bg-background-blend mb-6">
          {canEditWidgets && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className={isEditing ? 'submit' : 'bg-background-blend'}
                title={isEditing ? 'View mode' : 'Edit mode'}
                aria-label={
                  isEditing ? 'Switch to view mode' : 'Edit custom text'
                }
              >
                {isEditing ? 'Done' : <img src={editIcon} />}
              </button>
            </div>
          )}

          {canEditWidgets && isEditing ? (
            <div className="flex flex-col gap-3">
              <textarea
                defaultValue={widget.config?.content ?? ''}
                placeholder="Write your custom text..."
                maxLength={20000}
                rows={5}
                className="w-full resize-y rounded border border-current/20 bg-transparent p-3"
                onBlur={(event) =>
                  void onUpdateWidgetConfig(
                    widget.id,
                    'content',
                    event.target.value,
                  )
                }
              />

              {savingWidgetConfig && (
                <p className="text-xs opacity-50">Saving...</p>
              )}

              {widgetConfigError && (
                <p className="error-feedback">{widgetConfigError}</p>
              )}
            </div>
          ) : (
            <>
              <HorizontalHR />
              <ProfileContent html={widget.config?.content ?? ''} />
            </>
          )}
        </section>
      )

    default:
      return (
        <section className="mb-6 rounded border border-current/10 p-4">
          <h2 className="font-bold capitalize">{widget.type}</h2>
          <p className="mt-2 text-sm opacity-50">
            This widget has not been implemented yet.
          </p>
        </section>
      )
  }
}
