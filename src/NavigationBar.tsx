import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, AuthStatus } from './AuthContext'

import { VerticalHR, HorizontalHR, ProfileIcon } from './Utilites'

import SearchAndFilter from './SearchAndFilte'

// Images
import test_icon from './assets/images/test_icon.webp'
import more_icon from './assets/images/icons/moreIcon.webp'

function NavigationBar() {
  const { status, logout } = useAuth()
  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const navigate = useNavigate()
  const handleSelectChange = (e: any) => {
    const path = e.target.value
    if (path) {
      navigate(path)
    }
  }

  // Read initial theme from document class or default to dark
  const [currentTheme, setCurrentTheme] = useState(() => {
    const htmlClass = document.documentElement.className
    if (htmlClass.includes('light-theme')) return 'light'
    if (htmlClass.includes('green-theme')) return 'green'
    return 'dark'
  })

  useEffect(() => {
    // Clean up existing theme classes and apply the active one
    document.documentElement.classList.remove(
      'dark-theme',
      'light-theme',
      'green-theme',
    )
    document.documentElement.classList.add(`${currentTheme}-theme`)
    localStorage.setItem('theme', currentTheme)
  }, [currentTheme])

  {
    /* Mobile triggers */
  }
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  return (
    <nav className="sticky top-0 flex items-center justify-between p-4 shadow-2xs transition-colors duration-200">
      {/* Mobile search and filters */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          aria-expanded={isMobileSearchOpen}
          className="cursor-pointer p-2"
        >
          <img src={more_icon} alt="Åbn søgning og filtre" />
        </button>

        {/* Dropdown triggered by a click */}
        {isMobileSearchOpen && (
          <div
            className="absolute left-0 z-50 w-fit p-4 shadow-md"
            id="mobile-search"
          >
            <SearchAndFilter />
          </div>
        )}
      </div>

      {/* Home Icon */}
      <Link to="/">
        <img
          className="h-auto w-[30vw] lg:w-40"
          src={test_icon}
          alt="Statisk logo"
        />
      </Link>

      {/* Desktop search and filters */}
      <div className="hidden lg:block">
        <SearchAndFilter />
      </div>

      <div className="flex gap-4">
        <VerticalHR />

        {/* Drop-down menu for uploads */}
        <select
          onChange={handleSelectChange}
          defaultValue=""
          className="submit w-35"
        >
          <option value="" disabled>
            Submit...
          </option>
          <option value="/upload/image">Upload Image</option>
          <option value="/upload/journal">Upload Journal</option>
        </select>
      </div>

      <div className="flex items-center gap-4 pl-4">
        <VerticalHR />

        {/* Profile Dropdown Container */}
        <div className="drop-down">
          <ProfileIcon name="Name" />
          <div className="drop-down-content">
            {status === AuthStatus.Authenticated ? (
              <button id="logout" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <button className="login" onClick={() => navigate('/login')}>
                Login
              </button>
            )}

            <HorizontalHR />

            <div>
              <p>Switch theme</p>

              {/* Theme Switcher Controls */}
              <div>
                <button
                  id="dark-theme-option"
                  className="theme-option"
                  onClick={() => setCurrentTheme('dark')}
                ></button>
                <button
                  id="light-theme-option"
                  className="theme-option"
                  onClick={() => setCurrentTheme('light')}
                ></button>
                <button
                  id="green-theme-option"
                  className="theme-option"
                  onClick={() => setCurrentTheme('green')}
                ></button>
              </div>
            </div>

            <HorizontalHR />

            <button id="edit" disabled>
              Settings
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavigationBar
