import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { usersApi } from '../../../api'
import { useAuth } from '../../../AuthContext'

import { HorizontalHR } from '../../../Utilites'

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary']

function AccountInformation() {
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [realName, setRealName] = useState('')
  const [nameIsPublic, setNameIsPublic] = useState(false)

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
          setRealName(response.data.name ?? '')
          setNameIsPublic(response.data.nameIsPublic)

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
        ...(realName.trim() ? { name: realName.trim() } : {}),
        nameIsPublic,
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
    <div className="flex flex-col space-y-4">
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
            <label className="mb-1 block text-sm opacity-70">
              Email address
            </label>

            <input
              type="email"
              value={email}
              disabled
              className="bg-background-blend w-full rounded border p-3 opacity-70"
            />
          </div>

          <div>
            <label htmlFor="realName" className="mb-1 block text-sm opacity-70">
              Real name
            </label>

            <input
              id="realName"
              type="text"
              value={realName}
              maxLength={100}
              disabled={saving}
              onChange={(event) => setRealName(event.target.value)}
              placeholder="Your real name..."
              className="bg-background-blend w-full rounded border p-3"
            />

            <p className="mt-1 text-sm opacity-70">
              Your real name is private by default. You can choose whether to
              show it on your public profile.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={nameIsPublic}
              onChange={(event) => setNameIsPublic(event.target.checked)}
              disabled={saving}
            />
            Make my real name public
          </label>

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
              className="bg-background-blend w-full rounded border p-3"
              disabled={saving}
            />
          </div>

          <p>
            <b>Note: Don't lie; this is used for age verification.</b> This will
            not be collected for statistics if it is not made public.
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={birthDateIsPublic}
              onChange={(event) => setBirthDateIsPublic(event.target.checked)}
              disabled={saving}
              className="bg-background-blend"
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
              disabled={saving}
              className="bg-background-blend w-full rounded border p-3"
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
                disabled={saving}
                onChange={(event) => setCustomGender(event.target.value)}
                placeholder="Enter your gender"
                className="bg-background-blend w-full rounded border p-3"
              />
            </div>
          )}

          <p>
            This will not be collected for statistics if it is not made public.
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={genderIsPublic}
              onChange={(event) => setGenderIsPublic(event.target.checked)}
              disabled={saving}
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

          <div className="flex self-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="submit"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>

            <Link to="/">
              <button className="cancel">Cancel</button>
            </Link>
          </div>

          <HorizontalHR />
        </>
      )}
    </div>
  )
}

export default AccountInformation
