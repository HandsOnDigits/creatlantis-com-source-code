import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  profilesApi,
  type PublicProfile,
  type PublicProfileCustomization,
} from '../api'

import { HorizontalHR } from '../Utilites'

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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        const [profileResponse, customizationResponse] = await Promise.all([
          profilesApi.getByUsername(username),
          profilesApi.getCustomizationByUsername(username),
        ])

        if (!cancelled) {
          setProfile(profileResponse.data)
          setCustomization(customizationResponse.data)
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

  if (error || !profile) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-red-500">{error ?? 'Profile not found.'}</p>

        <Link to="/" className="mt-4 inline-block underline">
          Back to collection
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col p-6">
      <Link
        to="/"
        className="mb-6 inline-block transition-opacity hover:opacity-60"
      >
        ← Back to collection
      </Link>

      {/* Profile header */}
      <header className="mb-6">
        <h1 className="big-text font-bold">
          {profile.name ?? profile.username}
        </h1>

        <p className="mt-2 text-sm opacity-60">@{profile.username}</p>
      </header>

      <HorizontalHR />

      {/* Customized profile content */}
      <section className="w-full">
        <ProfileContent html={customization?.descriptionHtml ?? ''} />
      </section>
    </main>
  )
}

export default Profile
