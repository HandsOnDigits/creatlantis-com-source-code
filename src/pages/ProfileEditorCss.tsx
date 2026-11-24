import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { profilesApi } from '../api'
import { HorizontalHR } from '../Utilites'

function ProfileEditorCss() {
  const [customCss, setCustomCss] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCss() {
      try {
        setLoading(true)
        setError(null)

        const response = await profilesApi.getMyCustomization()

        if (!cancelled) {
          setCustomCss(response.data.customCss)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load custom CSS.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCss()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveCss() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await profilesApi.updateMyCustomization({
        customCss,
      })

      setCustomCss(response.data.customCss)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save custom CSS.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="p-8">Loading CSS editor...</main>
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="big-text font-bold">Custom CSS</h1>
        <p className="mt-2 opacity-60">
          Customize the appearance of your profile.
        </p>
        <HorizontalHR />
      </header>

      <section className="bg-background-blend flex flex-col gap-3 rounded border border-current/20 p-4">
        <label htmlFor="profile-css" className="font-bold">
          Profile styles
        </label>

        <textarea
          id="profile-css"
          value={customCss}
          onChange={(event) => {
            setCustomCss(event.target.value)
            setSuccess(false)
          }}
          maxLength={50_000}
          rows={20}
          className="w-full resize-y rounded border border-current/20 bg-transparent p-4 font-mono text-sm"
          placeholder="/* Your profile styles */"
        />

        <p className="text-xs opacity-50">
          {customCss.length.toLocaleString()} / 50,000 characters
        </p>
      </section>

      {error && (
        <p role="alert" className="error-feedback">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-green-500">
          Custom CSS saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveCss}
          disabled={saving}
          className="save"
        >
          {saving ? 'Saving...' : 'Save CSS'}
        </button>

        <Link to="/profile/edit" className="underline">
          Back to Profile Editor
        </Link>
      </div>
    </main>
  )
}

export default ProfileEditorCss
