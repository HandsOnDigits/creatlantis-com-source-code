import { useState, useEffect } from 'react'

import { VerticalHR, HorizontalHR, ProfileLink } from './Utilites'

// Image
import test_icon from './assets/images/test_icon.webp'

function NavigationBar() {
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

  return (
    <nav className="sticky top-0 flex items-center justify-between p-4 shadow-2xs transition-colors duration-200">
      <span className="font-medium">
        <img className="w-[70%]" src={test_icon} alt="Statisk logo" />
      </span>

      <VerticalHR />

      <VerticalHR />

      {/* Profile Dropdown Container */}
      <div className="drop-down">
        <ProfileLink name="Name" />
        <div className="drop-down-content">
          <button id="logout">Logout</button>
          <button id="login">Login</button>

          <HorizontalHR />

          <div className="block">
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
    </nav>
  )
}

export default NavigationBar
