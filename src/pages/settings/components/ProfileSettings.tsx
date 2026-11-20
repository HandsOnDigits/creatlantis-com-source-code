import { useEffect, useState } from 'react'

import { profilesApi, usersApi } from '../../../api'
import { useAuth } from '../../../AuthContext'

import ProfilePicture from './ProfilePicture'

function ProfileSettings() {
  const { user } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [nameIsPublic, setNameIsPublic] = useState(false)
  const [nameLoading, setNameLoading] = useState(true)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMessage, setNameMessage] = useState('')

  const [tagline, setTagline] = useState('')
  const [taglineLoading, setTaglineLoading] = useState(true)
  const [taglineSaving, setTaglineSaving] = useState(false)
  const [taglineMessage, setTaglineMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!user?.id) return

    usersApi
      .get(user.id)
      .then((response) => {
        if (!cancelled) {
          setDisplayName(response.data.name ?? '')
          setNameIsPublic(response.data.nameIsPublic)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNameMessage('Failed to load display name settings.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNameLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false

    if (!user?.username) return

    profilesApi
      .getByUsername(user.username)
      .then((response) => {
        if (!cancelled) {
          setTagline(response.data.tagline ?? '')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTaglineMessage('Failed to load tagline settings.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTaglineLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.username])

  const saveDisplayName = async () => {
    if (!user?.id) return

    setNameSaving(true)
    setNameMessage('')

    try {
      await usersApi.update(user.id, {
        name: displayName.trim(),
        nameIsPublic,
      })

      setNameMessage('Display name saved.')
    } catch {
      setNameMessage('Failed to save display name.')
    } finally {
      setNameSaving(false)
    }
  }

  const saveTagline = async () => {
    setTaglineSaving(true)
    setTaglineMessage('')

    try {
      await profilesApi.updateMyTagline(tagline.trim() || null)
      setTaglineMessage('Tagline saved.')
    } catch {
      setTaglineMessage('Failed to save tagline.')
    } finally {
      setTaglineSaving(false)
    }
  }

  if (!user) return null

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Public profile</h2>

      <ProfilePicture username={user.username} />

      <div className="space-y-3 border-t pt-6">
        <h3 className="font-medium">Display name</h3>

        <p className="text-sm opacity-70">
          Choose a display name for your account. You can keep it private or
          show it on your public profile.
        </p>

        {nameLoading ? (
          <p>Loading display name settings...</p>
        ) : (
          <>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={100}
              disabled={nameSaving}
              placeholder="Your display name..."
              className="w-full rounded border p-3"
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={nameIsPublic}
                onChange={(event) => setNameIsPublic(event.target.checked)}
                disabled={nameSaving}
              />
              Show display name on my public profile
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveDisplayName}
                disabled={nameSaving || displayName.trim().length === 0}
                className="submit"
              >
                {nameSaving ? 'Saving...' : 'Save display name'}
              </button>
            </div>
          </>
        )}

        {nameMessage && (
          <p className="text-sm" role="status">
            {nameMessage}
          </p>
        )}
      </div>

      <div className="space-y-3 border-t pt-6">
        <h3 className="font-medium">Tagline</h3>

        <p className="text-sm opacity-70">
          Write a short description that appears on your public profile.
        </p>

        {taglineLoading ? (
          <p>Loading tagline...</p>
        ) : (
          <>
            <textarea
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              maxLength={160}
              disabled={taglineSaving}
              placeholder="Tell people a little about yourself..."
              className="w-full rounded border p-3"
              rows={3}
            />

            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">{tagline.length}/160</span>

              <button
                type="button"
                onClick={saveTagline}
                disabled={taglineSaving || tagline.length > 160}
                className="submit"
              >
                {taglineSaving ? 'Saving...' : 'Save tagline'}
              </button>
            </div>
          </>
        )}

        {taglineMessage && (
          <p className="text-sm" role="status">
            {taglineMessage}
          </p>
        )}
      </div>
    </section>
  )
}

export default ProfileSettings
