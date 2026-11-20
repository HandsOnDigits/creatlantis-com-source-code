import { useEffect, useState, type ChangeEvent } from 'react'

// images
import default_pp from '../../../assets/images/default_pp.webp'

import { profilesApi } from '../../../api'
import { avatarsApi } from '../../../api'

interface ProfilePictureProps {
  username: string
}

function ProfilePicture({ username }: ProfilePictureProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    setLoading(true)

    profilesApi
      .getByUsername(username)
      .then((response) => {
        if (!cancelled) {
          setAvatarUrl(response.data.avatarUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('Failed to load profile picture.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [username])

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setMessage('')
    setUploading(true)

    try {
      const result = await avatarsApi.upload(file)
      setMessage(result.message)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to upload avatar.',
      )
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Profile picture</h3>

      {loading ? (
        <p>Loading profile picture...</p>
      ) : (
        <img
          src={avatarUrl ?? default_pp}
          alt="Current profile picture"
          className="h-24 w-24 object-cover"
        />
      )}

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={uploading}
        onChange={handleUpload}
      />

      {uploading && <p>Uploading avatar...</p>}

      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}

      <p className="text-sm opacity-70">
        Supported formats: JPEG, PNG, WebP and GIF. Maximum size: 5 MB. New
        profile pictures require approval before becoming public.
      </p>
    </div>
  )
}

export default ProfilePicture
