type ProfileTabType = 'profile' | 'content'

interface ProfileTabsProps {
  activeTab: ProfileTabType
  onChange: (tab: ProfileTabType) => void
}

function ProfileTabs({ activeTab, onChange }: ProfileTabsProps) {
  return (
    <nav
      className="mb-8 flex gap-6 border-b border-current/10"
      aria-label="Profile navigation"
    >
      <button
        type="button"
        onClick={() => onChange('profile')}
        aria-current={activeTab === 'profile' ? 'page' : undefined}
        className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
          activeTab === 'profile'
            ? 'border-current'
            : 'border-transparent opacity-50 hover:opacity-100'
        }`}
      >
        Profile
      </button>

      <button
        type="button"
        onClick={() => onChange('content')}
        aria-current={activeTab === 'content' ? 'page' : undefined}
        className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
          activeTab === 'content'
            ? 'border-current'
            : 'border-transparent opacity-50 hover:opacity-100'
        }`}
      >
        Content
      </button>
    </nav>
  )
}

export default ProfileTabs
