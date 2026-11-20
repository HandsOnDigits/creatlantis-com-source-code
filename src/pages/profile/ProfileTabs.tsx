import NavTabs, { ProfileIcon } from '../../Utilites'

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
      <NavTabs
        ariaLabel="Profile navigation"
        activeTab={activeTab}
        onChange={onChange}
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'content', label: 'Content' },
        ]}
      >
        <ProfileIcon
          name={profileInfo.name ?? profileInfo.username}
          image={profileInfo.avatarUrl}
          tagline={profileInfo.tagline}
        />
      </NavTabs>

      <p className="light-to-dark-gradient text-sm">
        {profileInfo.birthDate && (
          <>
            / Date of birth:{' '}
            {new Date(`${profileInfo.birthDate}T00:00:00`).toLocaleDateString()}
          </>
        )}

        {profileInfo.gender && <> / Gender: {profileInfo.gender} </>}
      </p>
    </>
  )
}

export default ProfileTabs
