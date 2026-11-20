import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { authApi } from '../../../api'

function ChangePassword() {
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [showPasswords, setShowPasswords] = useState(false)

  const savePassword = async () => {
    setMessage('')
    setError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields.')
      return
    }

    if (newPassword.length < 12) {
      setError('Your new password must contain at least 12 characters.')
      return
    }

    if (newPassword.length > 128) {
      setError('Your new password cannot exceed 128 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setSaving(true)

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      })

      setMessage('Password changed successfully.')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Clear the access token and revoke the current session.
      await authApi.logout()
    } catch {
      setError('Failed to change password. Please try again.')
      setSaving(false)
      return
    }

    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="font-medium">Change password</h3>

        <p className="mt-1 text-sm opacity-70">
          Choose a new password for your account.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm opacity-70">
          Current password
        </label>

        <input
          type={showPasswords ? 'text' : 'password'}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          disabled={saving}
          className="w-full rounded border p-3"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm opacity-70">New password</label>

        <input
          type={showPasswords ? 'text' : 'password'}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={saving}
          maxLength={128}
          className="w-full rounded border p-3"
        />

        <p className="mt-1 text-xs opacity-60">
          Minimum 12 characters, maximum 128.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm opacity-70">
          Confirm new password
        </label>

        <input
          type={showPasswords ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={saving}
          maxLength={128}
          className="w-full rounded border p-3"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={(event) => setShowPasswords(event.target.checked)}
          disabled={saving}
        />
        Show passwords
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={savePassword}
          disabled={saving}
          className="submit"
        >
          {saving ? 'Changing password...' : 'Change password'}
        </button>
      </div>

      {message && (
        <p className="text-sm text-green-600" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <p className="text-sm opacity-70">
        Changing your password signs you out of all devices. You will need to
        log in again.
      </p>
    </div>
  )
}

export default ChangePassword
