import { useEffect, useState } from 'react'

import { profilesApi, usersApi } from '../../../api'
import { useAuth } from '../../../AuthContext'

import { HorizontalHR } from '../../../Utilites'

import ProfilePicture from './ProfilePicture'

function ProfileSettings() {
  const { user, updateUsername } = useAuth()

  const [username, setUsername] = useState(user?.username ?? '')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState('')

  const [tagline, setTagline] = useState('')
  const [taglineLoading, setTaglineLoading] = useState(true)
  const [taglineSaving, setTaglineSaving] = useState(false)
  const [taglineMessage, setTaglineMessage] = useState('')

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

  const saveUsername = async () => {
    const trimmedUsername = username.trim()

    if (!trimmedUsername || trimmedUsername === user?.username) return

    const confirmed = window.confirm(
      `Are you sure you want to change your username from "${user?.username}" to "${trimmedUsername}"?\n\nYour old profile URL will stop working. Anyone using links to your old profile will no longer be able to reach it.`,
    )

    if (!confirmed) return

    setUsernameSaving(true)
    setUsernameMessage('')

    try {
      const response = await usersApi.update(user!.id, {
        username: trimmedUsername,
      })

      updateUsername(response.data.username)
      setUsername(response.data.username)
      setUsernameMessage('Username changed successfully.')
    } catch {
      setUsernameMessage('Failed to change username. It may already be taken.')
    } finally {
      setUsernameSaving(false)
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
    <section className="bg-background-blend space-y-6 p-4">
      <h2 className="big-text font-semibold">Public profile</h2>

      <HorizontalHR />

      <div className="space-y-3">
        <h3 className="font-medium">Username</h3>

        <p className="text-sm opacity-70">
          Your username is used in your public profile URL.
        </p>

        <p className="text-sm text-amber-600">
          Changing your username will invalidate your old profile URL. Existing
          links to your old username will stop working.
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={30}
            disabled={usernameSaving}
            className="bg-background-blend w-full rounded border p-3"
            autoComplete="username"
          />

          <button
            type="button"
            onClick={saveUsername}
            disabled={
              usernameSaving ||
              !username.trim() ||
              username.trim() === user.username
            }
            className="submit self-center"
          >
            {usernameSaving ? 'Saving...' : 'Change username'}
          </button>
        </div>

        {usernameMessage && (
          <p className="text-sm" role="status">
            {usernameMessage}
          </p>
        )}
      </div>

      <HorizontalHR />

      <ProfilePicture username={user.username} />

      <HorizontalHR />

      <div className="space-y-3 pt-6">
        <h3 className="font-medium">Tagline</h3>

        <p className="text-sm opacity-70">
          Write a short description that appears on your public profile.
        </p>

        {taglineLoading ? (
          <p>Loading tagline...</p>
        ) : (
          <div className="flex flex-col">
            <textarea
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              maxLength={160}
              disabled={taglineSaving}
              placeholder="Tell people a little about yourself..."
              className="w-full rounded border p-3"
              rows={3}
            />

            <span className="self-start text-sm opacity-70">
              {tagline.length}/160
            </span>

            <button
              type="button"
              onClick={saveTagline}
              disabled={taglineSaving || tagline.length > 160}
              className="submit self-center"
            >
              {taglineSaving ? 'Saving...' : 'Save tagline'}
            </button>
          </div>
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
