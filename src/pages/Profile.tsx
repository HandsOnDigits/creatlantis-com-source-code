import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../AuthContext'

// Taps
import ProfileTabs from './profile/ProfileTabs'
import ProfileTab from './profile/ProfileTab'
import ContentTab from './profile/ContentTab'

import {
  postsApi,
  profilesApi,
  notesApi,
  type Post,
  type PublicProfile,
  type PublicProfileCustomization,
  type ProfileLayout,
} from '../api'

function Profile() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const [isNoteComposerOpen, setIsNoteComposerOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteSending, setNoteSending] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

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

  async function sendNote() {
    if (!profile || !noteContent.trim() || noteSending) return

    setNoteSending(true)
    setNoteError(null)

    try {
      const conversation = await notesApi.createConversation(profile.identityId)

      await notesApi.sendMessage(
        conversation.conversationId,
        noteContent.trim(),
      )

      setIsNoteComposerOpen(false)
      setNoteContent('')
      window.location.href = `/notes?conversationId=${encodeURIComponent(conversation.conversationId)}`
    } catch (err) {
      console.error('Failed to send note:', err)
      setNoteError(err instanceof Error ? err.message : 'Failed to send note.')
    } finally {
      setNoteSending(false)
    }
  }

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
    <main className="relative min-h-screen">
      {user && profile.identityId !== user.identityId && (
        <button
          type="button"
          onClick={() => setIsNoteComposerOpen(true)}
          title="Write a note"
          aria-label="Write a note"
          className="absolute top-4 right-4 z-10 rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow-sm transition hover:bg-gray-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}

      {isNoteComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-composer-title"
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
          >
            <h2
              id="note-composer-title"
              className="mb-2 text-xl font-semibold text-gray-900"
            >
              Write a note to @{profile.username}
            </h2>

            <textarea
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              maxLength={10000}
              rows={6}
              placeholder="Write your note..."
              className="w-full resize-y rounded-md border border-gray-300 p-3 text-gray-900 outline-none focus:border-blue-500"
              autoFocus
            />

            {noteError && (
              <p className="mt-2 text-sm text-red-600">{noteError}</p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsNoteComposerOpen(false)
                  setNoteError(null)
                }}
                disabled={noteSending}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={sendNote}
                disabled={!noteContent.trim() || noteSending}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {noteSending ? 'Sending...' : 'Send note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfileTabs
        activeTab={activeTab}
        onChange={changeTab}
        profileInfo={profile}
      />

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
