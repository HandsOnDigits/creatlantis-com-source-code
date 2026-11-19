import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const navigation = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: '⌂',
  },
  {
    label: 'Posts',
    path: '/admin/posts',
    icon: '▤',
  },
  {
    label: 'Avatars',
    path: '/admin/avatars',
    icon: '◉',
  },
  {
    label: 'Reports',
    path: '/admin/reports',
    icon: '⚑',
  },
  {
    label: 'Categories',
    path: '/admin/categories',
    icon: '◇',
  },
]

const API_URL = 'http://localhost:3001/api'

export default function AdminLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Unable to log out. Please try again.')
      }

      navigate('/login', { replace: true })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="bg-admin-bg min-h-screen text-white md:flex">
      <aside className="border-admin-border w-full border-b p-5 md:min-h-screen md:w-64 md:border-r md:border-b-0">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">CreAtlantis</h1>
          <p className="text-admin-muted mt-1 text-xs">Administration</p>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-white/10 font-semibold text-white'
                    : 'text-admin-muted hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="w-5 text-center" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-admin-muted w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-admin-border flex h-16 items-center border-b px-6">
          <span className="text-admin-muted text-sm font-medium">
            Administration panel
          </span>
        </header>

        <main className="p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
