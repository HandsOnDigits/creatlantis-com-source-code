import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { profilesApi } from '../api'
import { HorizontalHR } from '../Utilites'

function ProfileEditorBio() {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadBio() {
      try {
        setLoading(true)
        setError(null)

        const response = await profilesApi.getMyCustomization()

        if (!cancelled) {
          setDescription(response.data.description)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load profile BIO.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadBio()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveBio() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await profilesApi.updateMyCustomization({
        description,
      })

      setDescription(response.data.description)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save profile BIO.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="p-8">Loading BIO editor...</main>
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="big-text font-bold">Profile BIO</h1>
        <p className="mt-2 opacity-60">Edit your profile biography.</p>
        <HorizontalHR />
      </header>

      <section className="bg-background-blend flex flex-col gap-3 rounded border border-current/20 p-4">
        <label htmlFor="profile-bio" className="font-bold">
          Biography content
        </label>

        <p className="text-sm opacity-60">
          Write your biography using BBCode, Markdown, or HTML. HTML is
          sanitized before display.
        </p>

        <textarea
          id="profile-bio"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            setSuccess(false)
          }}
          maxLength={20_000}
          rows={16}
          className="w-full resize-y rounded border border-current/20 bg-transparent p-3 font-mono text-sm"
          placeholder="[b]Welcome to my profile![/b]"
        />

        <p className="text-xs opacity-50">
          {description.length.toLocaleString()} / 20,000 characters
        </p>
      </section>

      {error && (
        <p role="alert" className="error-feedback">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-green-500">
          Profile BIO saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveBio}
          disabled={saving}
          className="save"
        >
          {saving ? 'Saving...' : 'Save BIO'}
        </button>

        <Link to="/profile/edit" className="underline">
          Back to Profile Editor
        </Link>
      </div>
    </main>
  )
}

export default ProfileEditorBio
