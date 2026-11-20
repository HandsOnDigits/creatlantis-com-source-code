import { useState } from 'react'

import ProfileSettings from './components/ProfileSettings'
import AccountSettings from './components/AccountSettings'

type SettingsTab = 'profile' | 'account'

function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

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

      {activeTab === 'profile' && <ProfileSettings />}

      {activeTab === 'account' && <AccountSettings />}
    </main>
  )
}

export default Settings
