import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import ProfileTabs from './profile/ProfileTabs'
import ProfileTab from './profile/ProfileTab'
import ContentTab from './profile/ContentTab'

import {
  postsApi,
  profilesApi,
  type Post,
  type PublicProfile,
  type PublicProfileCustomization,
  type ProfileLayout,
} from '../api'

function Profile() {
  const { username } = useParams<{ username: string }>()

  const [profile, setProfile] = useState<PublicProfile | null>(null)

  const [customization, setCustomization] =
    useState<PublicProfileCustomization | null>(null)

  const [layout, setLayout] = useState<ProfileLayout | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab =
    searchParams.get('tab') === 'content' ? 'content' : 'profile'

  function changeTab(tab: 'profile' | 'content') {
    const nextParams = new URLSearchParams(searchParams)

    if (tab === 'profile') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', tab)
    }

    setSearchParams(nextParams)
  }

  const [contentPosts, setContentPosts] = useState<Post[]>([])
  const [contentLoading, setContentLoading] = useState(false)
  const [contentHasMore, setContentHasMore] = useState(false)
  const [contentPage, setContentPage] = useState(1)

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

    async function loadContent() {
      try {
        setContentLoading(true)

        const response = await postsApi.listByUsername(username!, 1, 12)

        if (!cancelled) {
          setContentPosts(response.data)
          setContentHasMore(response.pagination.hasMore)
          setContentPage(1)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load profile content:', err)
          setContentPosts([])
          setContentHasMore(false)
        }
      } finally {
        if (!cancelled) {
          setContentLoading(false)
        }
      }
    }

    loadContent()

    return () => {
      cancelled = true
    }
  }, [username])

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

  async function loadMoreContent() {
    if (!username || contentLoading || !contentHasMore) {
      return
    }

    const nextPage = contentPage + 1

    try {
      setContentLoading(true)

      const response = await postsApi.listByUsername(username, nextPage, 12)

      setContentPosts((current) => [...current, ...response.data])
      setContentHasMore(response.pagination.hasMore)
      setContentPage(nextPage)
    } catch (err) {
      console.error('Failed to load more content:', err)
    } finally {
      setContentLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-6">
      {/* Profile header */}
      <header className="mb-6">
        <h1 className="big-text font-bold">
          {profile.name ?? profile.username}
        </h1>

        <p className="mt-2 text-sm opacity-60">@{profile.username}</p>
      </header>

      <ProfileTabs activeTab={activeTab} onChange={changeTab} />

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <ProfileTab
          profile={profile}
          customization={customization}
          layout={layout}
          galleryPosts={galleryPosts}
          galleryLoading={galleryLoading}
          galleryHasMore={galleryHasMore}
          onLoadMoreGallery={loadMoreGallery}
          journalPosts={journalPosts}
          journalLoading={journalLoading}
          journalHasMore={journalHasMore}
          onLoadMoreJournal={loadMoreJournal}
        />
      )}

      {/* Content tab */}
      {activeTab === 'content' && (
        <ContentTab
          posts={contentPosts}
          loading={contentLoading}
          hasMore={contentHasMore}
          onLoadMore={loadMoreContent}
        />
      )}
    </main>
  )
}

export default Profile
