import default_pp from './assets/images/default_pp.webp'

interface profileInfo {
  name: string
  image?: string | null
  tagline?: string | null
}

export function ProfileIcon({ name, image, tagline }: profileInfo) {
  return (
    <div className="user-profile inline-flex items-center p-2">
      <img className="h-auto w-20" src={image ?? default_pp} alt="" />

      <div className="p-3 pb-0">
        <p className="text-lg font-semibold">{name}</p>

        {tagline && <p className="text-sm opacity-70">{tagline}</p>}
      </div>
    </div>
  )
}

/* Divide lines */

export function VerticalHR() {
  return <div className="border-vr-line h-12 border-l-3"></div>
}

export function HorizontalHR() {
  return <div className="border-hr-line my-3 w-[90%] border-b-3"></div>
}

import type { ReactNode } from 'react'

export interface NavTab<T extends string = string> {
  id: T
  label: string
}

interface NavTabsProps<T extends string> {
  tabs: NavTab<T>[]
  activeTab: T
  onChange: (tab: T) => void
  ariaLabel: string
  children?: ReactNode
}

/* Nav tabs */

function NavTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  children,
}: NavTabsProps<T>) {
  return (
    <nav className="nav-tabs" aria-label={ariaLabel}>
      {children}

      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={activeTab === tab.id ? 'selected-tab' : ''}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export default NavTabs
