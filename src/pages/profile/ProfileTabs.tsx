import { ProfileIcon } from '../../Utilites'

import { type PublicProfile } from '../../api'

type ProfileTabType = 'profile' | 'content'

interface ProfileTabsProps {
  activeTab: ProfileTabType
  onChange: (tab: ProfileTabType) => void
  profileInfo: PublicProfile
}

function ProfileTabs({ activeTab, onChange, profileInfo }: ProfileTabsProps) {
  return (
    <>
      <nav className="nav-tabs" aria-label="Profile navigation">
        <ProfileIcon
          name={profileInfo.name ?? profileInfo.username}
          image={profileInfo.avatarUrl}
          tagline={profileInfo.tagline}
        />
        <button
          type="button"
          onClick={() => onChange('profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={activeTab === 'profile' ? 'selected-tab' : ''}
        >
          Profile
        </button>

        <button
          type="button"
          onClick={() => onChange('content')}
          aria-current={activeTab === 'content' ? 'page' : undefined}
          className={activeTab === 'content' ? 'selected-tab' : ''}
        >
          Content
        </button>
      </nav>
      <div className="light-to-dark-gradient"></div>
    </>
  )
}

export default ProfileTabs
