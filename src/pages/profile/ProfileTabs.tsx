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
      <p className="light-to-dark-gradient text-sm">
        {profileInfo.birthDate && (
          <>
            / Date of birth:{' '}
            {new Date(`${profileInfo.birthDate}T00:00:00`).toLocaleDateString()}
          </>
        )}
      </p>
    </>
  )
}

export default ProfileTabs
