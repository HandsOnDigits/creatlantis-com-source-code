import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { profilesApi } from '../api'

function ProfileEditor() {
  const [description, setDescription] = useState('')
  const [customCss, setCustomCss] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCustomization() {
      try {
        setLoading(true)
        setError(null)

        const response = await profilesApi.getMyCustomization()

        if (!cancelled) {
          setDescription(response.data.description)
          setCustomCss(response.data.customCss)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load profile customization.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCustomization()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveCustomization() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await profilesApi.updateMyCustomization({
        description,
        customCss,
      })

      setDescription(response.data.description)
      setCustomCss(response.data.customCss)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save profile customization.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="p-8">Loading profile editor...</main>
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="big-text font-bold">Profile Editor</h1>
        <p className="mt-2 opacity-60">Customize your CreAtlantis profile.</p>
      </header>

      <section className="flex flex-col gap-3">
        <label htmlFor="profile-description" className="font-bold">
          Profile description (BBCode)
        </label>

        <textarea
          id="profile-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            setSuccess(false)
          }}
          maxLength={20_000}
          rows={14}
          className="w-full resize-y rounded border border-current/20 bg-transparent p-4 font-mono text-sm"
          placeholder="[b]Welcome to my profile![/b]"
        />

        <p className="text-xs opacity-50">
          {description.length.toLocaleString()} / 20,000 characters
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <label htmlFor="profile-css" className="font-bold">
          Custom CSS
        </label>

        <textarea
          id="profile-css"
          value={customCss}
          onChange={(event) => {
            setCustomCss(event.target.value)
            setSuccess(false)
          }}
          maxLength={50_000}
          rows={14}
          className="w-full resize-y rounded border border-current/20 bg-transparent p-4 font-mono text-sm"
          placeholder="/* Your profile styles */"
        />

        <p className="text-xs opacity-50">
          {customCss.length.toLocaleString()} / 50,000 characters
        </p>
      </section>

      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-green-500">
          Profile customization saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveCustomization}
          disabled={saving}
          className="rounded border border-current px-6 py-3 transition-opacity hover:opacity-60 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>

        <Link to="/" className="underline opacity-70 hover:opacity-100">
          Cancel
        </Link>
      </div>
    </main>
  )
}

export default ProfileEditor
