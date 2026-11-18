import { Link } from 'react-router-dom'

import { Image, Journal } from '../../PostElements'
import ProfileContent from './ProfileContent'

import { HorizontalHR } from '../../Utilites'

import type {
  Post,
  PublicProfile,
  PublicProfileCustomization,
  ProfileLayout,
  ProfileWidget,
} from '../../api'

interface ProfileTabProps {
  profile: PublicProfile
  customization: PublicProfileCustomization | null
  layout: ProfileLayout

  galleryPosts: Post[]
  galleryLoading: boolean
  galleryHasMore: boolean
  onLoadMoreGallery: () => void

  journalPosts: Post[]
  journalLoading: boolean
  journalHasMore: boolean
  onLoadMoreJournal: () => void
}

function ProfileTab({
  profile,
  customization,
  layout,
  galleryPosts,
  galleryLoading,
  galleryHasMore,
  onLoadMoreGallery,
  journalPosts,
  journalLoading,
  journalHasMore,
  onLoadMoreJournal,
}: ProfileTabProps) {
  function renderWidget(widget: ProfileWidget) {
    switch (widget.type) {
      case 'header':
        return (
          <header key={widget.id} className="mb-4">
            <h1 className="big-text bg-background-blend font-bold">
              {profile.name ?? profile.username}
            </h1>
            <p className="mt-2 text-sm opacity-60">@{profile.username}</p>
          </header>
        )

      case 'bio':
        return (
          <section key={widget.id} className="bg-background-blend mb-6">
            <h2 className="mb-4 text-xl font-bold">About</h2>

            <HorizontalHR />

            <ProfileContent html={customization?.descriptionHtml ?? ''} />
          </section>
        )

      case 'gallery':
        return (
          <section key={widget.id} className="bg-background-blend mb-6">
            <h2 className="mb-4 text-xl font-bold">Gallery</h2>

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
          <section key={widget.id} className="bg-background-blend mb-6">
            <h2 className="mb-4 text-xl font-bold">Journal</h2>

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

      default:
        return (
          <section
            key={widget.id}
            className="mb-6 rounded border border-current/10 p-4"
          >
            <h2 className="font-bold capitalize">
              {widget.type === 'customText' ? 'Custom text' : widget.type}
            </h2>
            <p className="mt-2 text-sm opacity-50">
              This widget has not been implemented yet.
            </p>
          </section>
        )
    }
  }

  const mainColumn = layout.columns.find((column) => column.id === 'main')
  const sidebarColumn = layout.columns.find((column) => column.id === 'sidebar')

  return (
    <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        {mainColumn?.widgets.map((widget) => {
          if (widget.type === 'header') return null
          return renderWidget(widget)
        })}
      </div>

      <aside className="min-w-0">
        {sidebarColumn?.widgets.map((widget) => {
          if (widget.type === 'header') return null
          return renderWidget(widget)
        })}
      </aside>
    </div>
  )
}

export default ProfileTab
