import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Image, Journal } from '../PostElements'

import {
  postsApi,
  profilesApi,
  type Post,
  type PublicProfile,
  type PublicProfileCustomization,
  type ProfileLayout,
  type ProfileWidget,
} from '../api'

function ProfileContent({ html }: { html: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host {
        display: block;
        color: inherit;
        font-family: inherit;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      a {
        color: inherit;
        text-decoration: underline;
      }

      table {
        max-width: 100%;
        border-collapse: collapse;
      }
    `

    const content = document.createElement('div')
    content.innerHTML = html

    shadow.replaceChildren(style, content)

    return () => {
      shadow.replaceChildren()
    }
  }, [html])

  return <div ref={hostRef} className="w-full" />
}

function Profile() {
  const { username } = useParams<{ username: string }>()

  const [profile, setProfile] = useState<PublicProfile | null>(null)

  const [customization, setCustomization] =
    useState<PublicProfileCustomization | null>(null)

  const [layout, setLayout] = useState<ProfileLayout | null>(null)

  const [galleryPosts, setGalleryPosts] = useState<Post[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryHasMore, setGalleryHasMore] = useState(false)
  const [galleryPage, setGalleryPage] = useState(1)

  const [journalPosts, setJournalPosts] = useState<Post[]>([])
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalHasMore, setJournalHasMore] = useState(false)
  const [journalPage, setJournalPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return
    }

    let cancelled = false

    async function loadGallery() {
      try {
        setGalleryLoading(true)

        const response = await postsApi.listByUsername(
          username!,
          1,
          12,
          'IMAGE',
        )

        if (!cancelled) {
          setGalleryPosts(response.data)
          setGalleryHasMore(response.pagination.hasMore)
          setGalleryPage(1)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load profile gallery:', err)
          setGalleryPosts([])
          setGalleryHasMore(false)
        }
      } finally {
        if (!cancelled) {
          setGalleryLoading(false)
        }
      }
    }

    loadGallery()

    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return
    }

    let cancelled = false

    async function loadJournal() {
      try {
        setJournalLoading(true)

        const response = await postsApi.listByUsername(
          username!,
          1,
          12,
          'JOURNAL',
        )

        if (!cancelled) {
          setJournalPosts(response.data)
          setJournalHasMore(response.pagination.hasMore)
          setJournalPage(1)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load profile journal:', err)
          setJournalPosts([])
          setJournalHasMore(false)
        }
      } finally {
        if (!cancelled) {
          setJournalLoading(false)
        }
      }
    }

    loadJournal()

    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Invalid username.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const [profileResponse, customizationResponse, layoutResponse] =
          await Promise.all([
            profilesApi.getByUsername(username),
            profilesApi.getCustomizationByUsername(username),
            profilesApi.getLayoutByUsername(username),
          ])

        if (!cancelled) {
          setProfile(profileResponse.data)
          setCustomization(customizationResponse.data)
          setLayout(layoutResponse.data.layout)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load profile.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [username])

  if (loading) {
    return <div className="p-8">Loading profile...</div>
  }

  if (error || !profile || !layout) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-red-500">{error ?? 'Profile not found.'}</p>

        <Link to="/" className="mt-4 inline-block underline">
          Back to collection
        </Link>
      </main>
    )
  }

  async function loadMoreGallery() {
    if (!username || galleryLoading || !galleryHasMore) {
      return
    }

    const nextPage = galleryPage + 1

    try {
      setGalleryLoading(true)

      const response = await postsApi.listByUsername(username, nextPage, 12)

      setGalleryPosts((current) => [...current, ...response.data])
      setGalleryHasMore(response.pagination.hasMore)
      setGalleryPage(nextPage)
    } catch (err) {
      console.error('Failed to load more gallery posts:', err)
    } finally {
      setGalleryLoading(false)
    }
  }

  async function loadMoreJournal() {
    if (!username || journalLoading || !journalHasMore) {
      return
    }

    const nextPage = journalPage + 1

    try {
      setJournalLoading(true)

      const response = await postsApi.listByUsername(
        username,
        nextPage,
        12,
        'JOURNAL',
      )

      setJournalPosts((current) => [...current, ...response.data])
      setJournalHasMore(response.pagination.hasMore)
      setJournalPage(nextPage)
    } catch (err) {
      console.error('Failed to load more journal posts:', err)
    } finally {
      setJournalLoading(false)
    }
  }

  function renderWidget(widget: ProfileWidget) {
    switch (widget.type) {
      case 'header':
        return (
          <header key={widget.id} className="mb-4">
            <h1 className="big-text font-bold">
              {profile!.name ?? profile!.username}
            </h1>
            <p className="mt-2 text-sm opacity-60">@{profile!.username}</p>
          </header>
        )

      case 'bio':
        return (
          <section key={widget.id} className="mb-6">
            <ProfileContent html={customization?.descriptionHtml ?? ''} />
          </section>
        )

      case 'gallery':
        return (
          <section key={widget.id} className="mb-6">
            <h2 className="mb-4 text-xl font-bold">Gallery</h2>

            {galleryLoading && galleryPosts.length === 0 ? (
              <p className="text-sm opacity-60">Loading gallery...</p>
            ) : galleryPosts.length === 0 ? (
              <p className="text-sm opacity-60">No artwork published yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    onClick={loadMoreGallery}
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
          <section key={widget.id} className="mb-6">
            <h2 className="mb-4 text-xl font-bold">Journal</h2>

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
                    onClick={loadMoreJournal}
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
    <main className="min-h-screen p-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {mainColumn?.widgets.map(renderWidget)}
        </div>

        <aside className="min-w-0">
          {sidebarColumn?.widgets.map(renderWidget)}
        </aside>
      </div>
    </main>
  )
}

export default Profile
