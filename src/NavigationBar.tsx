import { useState, useEffect } from 'react'

import { VerticalHR, ProfileLink } from './Utilites'

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

      <ProfileLink name="Name" />

      {/* Theme Switcher Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-80">Theme:</span>
        <button
          onClick={() => setCurrentTheme('dark')}
          className={`rounded px-3 py-1 text-sm transition-all ${
            currentTheme === 'dark'
              ? 'font-bold ring-2 ring-neutral-400 ring-offset-2'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          Dark
        </button>
        <button
          onClick={() => setCurrentTheme('light')}
          className={`rounded px-3 py-1 text-sm transition-all ${
            currentTheme === 'light'
              ? 'font-bold ring-2 ring-neutral-600 ring-offset-2'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          Light
        </button>
        <button
          onClick={() => setCurrentTheme('green')}
          className={`rounded px-3 py-1 text-sm transition-all ${
            currentTheme === 'green'
              ? 'font-bold ring-2 ring-green-600 ring-offset-2'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          Green
        </button>
      </div>
    </nav>
  )
}

export default NavigationBar
