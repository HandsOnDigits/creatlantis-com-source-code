import { useEffect, useState, type ChangeEvent } from 'react'

import { profilesApi, usersApi } from '../api'
import { avatarsApi } from '../api'
import { useAuth } from '../AuthContext'

function Settings() {
  const { user } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [nameIsPublic, setNameIsPublic] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMessage, setNameMessage] = useState('')

  const [tagline, setTagline] = useState('')
  const [taglineLoading] = useState(false)
  const [taglineSaving, setTaglineSaving] = useState(false)
  const [taglineMessage, setTaglineMessage] = useState('')

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile')

  useEffect(() => {
    let cancelled = false

    if (!user?.username) return

    setProfileLoading(true)

    profilesApi
      .getByUsername(user.username)
      .then((response) => {
        if (!cancelled) {
          setTagline(response.data.tagline ?? '')
          setAvatarUrl(response.data.avatarUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTaglineMessage('Failed to load profile settings.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.username])

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

    return () => {
      cancelled = true
    }
  }, [user?.id])

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

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setAvatarMessage('')
    setAvatarUploading(true)

    try {
      const result = await avatarsApi.upload(file)

      setAvatarMessage(result.message)
      event.target.value = ''
    } catch (error) {
      setAvatarMessage(
        error instanceof Error ? error.message : 'Failed to upload avatar.',
      )
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>

      <div className="mb-6 flex gap-4 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={
            activeTab === 'profile'
              ? 'border-b-2 border-current pb-2 font-bold'
              : 'pb-2'
          }
        >
          Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={
            activeTab === 'account'
              ? 'border-b-2 border-current pb-2 font-bold'
              : 'pb-2'
          }
        >
          Account
        </button>
      </div>

      {activeTab === 'profile' && (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Public profile</h2>

          <div>
            <h3>Profile picture</h3>
            {profileLoading ? (
              <p>Loading profile picture...</p>
            ) : (
              <img
                src={avatarUrl ?? '/default_pp.webp'}
                alt="Current profile picture"
                className="mb-3 h-24 w-24 rounded-full object-cover"
              />
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={avatarUploading}
              onChange={handleAvatarUpload}
            />

            {avatarUploading && <p>Uploading avatar...</p>}
            {avatarMessage && <p>{avatarMessage}</p>}
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Display name</h3>

            <p className="text-sm opacity-70">
              Choose a display name for your account. You can keep it private or
              show it on your public profile.
            </p>

            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              disabled={nameSaving}
              placeholder="Your display name..."
              className="w-full rounded border p-3"
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={nameIsPublic}
                onChange={(e) => setNameIsPublic(e.target.checked)}
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

            {nameMessage && (
              <p className="text-sm" role="status">
                {nameMessage}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Tagline</h3>

            <p className="text-sm opacity-70">
              Write a short description that appears on your public profile.
            </p>

            <textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={160}
              disabled={taglineLoading || taglineSaving}
              placeholder="Tell people a little about yourself..."
              className="w-full rounded border p-3"
              rows={3}
            />

            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">{tagline.length}/160</span>

              <button
                type="button"
                onClick={saveTagline}
                disabled={
                  taglineLoading || taglineSaving || tagline.length > 160
                }
                className="submit"
              >
                {taglineSaving ? 'Saving...' : 'Save tagline'}
              </button>
            </div>

            {taglineMessage && (
              <p className="text-sm" role="status">
                {taglineMessage}
              </p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'account' && (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Account</h2>
          <p className="text-sm opacity-70">
            Account and security settings will be available here.
          </p>
        </section>
      )}
    </main>
  )
}

export default Settings
