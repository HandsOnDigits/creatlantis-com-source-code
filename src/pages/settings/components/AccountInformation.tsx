import { useEffect, useState } from 'react'

import { usersApi } from '../../../api'
import { useAuth } from '../../../AuthContext'

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary']

function AccountInformation() {
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthDateIsPublic, setBirthDateIsPublic] = useState(false)

  const [genderOption, setGenderOption] = useState('')
  const [customGender, setCustomGender] = useState('')
  const [genderIsPublic, setGenderIsPublic] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!user?.id) return

    setLoading(true)
    setError('')

    usersApi
      .get(user.id)
      .then((response) => {
        if (!cancelled) {
          const gender = response.data.gender

          setEmail(response.data.email)
          setBirthDate(response.data.birthDate ?? '')
          setBirthDateIsPublic(response.data.birthDateIsPublic)

          if (!gender) {
            setGenderOption('')
            setCustomGender('')
          } else if (GENDER_OPTIONS.includes(gender)) {
            setGenderOption(gender)
            setCustomGender('')
          } else {
            setGenderOption('custom')
            setCustomGender(gender)
          }

          setGenderIsPublic(response.data.genderIsPublic)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load account information.')
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
  }, [user?.id])

  async function handleSave() {
    if (!user?.id) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const gender =
        genderOption === 'custom'
          ? customGender.trim() || null
          : genderOption || null

      await usersApi.update(user.id, {
        birthDate: birthDate || null,
        birthDateIsPublic,
        gender,
        genderIsPublic,
      })

      setMessage('Account information updated.')
    } catch {
      setError('Failed to update account information.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Account information</h3>

      {loading ? (
        <p>Loading account information...</p>
      ) : error && !email ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm opacity-70">Username</label>

            <input
              type="text"
              value={user?.username ?? ''}
              disabled
              className="w-full rounded border p-3 opacity-70"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm opacity-70">
              Email address
            </label>

            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded border p-3 opacity-70"
            />
          </div>

          <div>
            <label
              htmlFor="birthDate"
              className="mb-1 block text-sm opacity-70"
            >
              Date of birth
            </label>

            <input
              id="birthDate"
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setBirthDate(event.target.value)}
              className="w-full rounded border p-3"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={birthDateIsPublic}
              onChange={(event) => setBirthDateIsPublic(event.target.checked)}
            />
            Make my date of birth public
          </label>

          <div>
            <label htmlFor="gender" className="mb-1 block text-sm opacity-70">
              Gender
            </label>

            <select
              id="gender"
              value={genderOption}
              onChange={(event) => setGenderOption(event.target.value)}
              className="w-full rounded border p-3"
            >
              <option value="">Prefer not to say</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="custom">Other / custom</option>
            </select>
          </div>

          {genderOption === 'custom' && (
            <div>
              <label
                htmlFor="customGender"
                className="mb-1 block text-sm opacity-70"
              >
                Describe your gender
              </label>

              <input
                id="customGender"
                type="text"
                value={customGender}
                maxLength={100}
                onChange={(event) => setCustomGender(event.target.value)}
                placeholder="Enter your gender"
                className="w-full rounded border p-3"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={genderIsPublic}
              onChange={(event) => setGenderIsPublic(event.target.checked)}
            />
            Make my gender public
          </label>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-green-600" role="status">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </>
      )}
    </div>
  )
}

export default AccountInformation
