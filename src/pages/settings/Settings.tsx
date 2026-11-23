import { useState } from 'react'

import NavTabs from '../../Utilites'

import ProfileSettings from './components/ProfileSettings'
import AccountSettings from './components/AccountSettings'

type SettingsTab = 'profile' | 'account'

function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <main className="mx-auto flex w-full flex-col items-center">
      <NavTabs<SettingsTab>
        ariaLabel="Settings navigation"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'account', label: 'Account' },
        ]}
      >
        <h1 className="mr-2 text-3xl font-bold">Settings</h1>
      </NavTabs>
      <div className="light-to-dark-gradient h-8"></div>
      <div className="max-w-4xl p-4">
        {activeTab === 'profile' && <ProfileSettings />}

        {activeTab === 'account' && <AccountSettings />}
      </div>
    </main>
  )
}

export default Settings
