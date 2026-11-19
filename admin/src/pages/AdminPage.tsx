import { Link } from 'react-router-dom'

const sections = [
  {
    title: 'Posts',
    description: 'Review and moderate posts awaiting approval.',
    path: '/admin/posts',
  },
  {
    title: 'Avatars',
    description: 'Review user profile pictures awaiting approval.',
    path: '/admin/avatars',
  },
  {
    title: 'Reports',
    description: 'Review and manage reports submitted by users.',
    path: '/admin/reports',
  },
  {
    title: 'Categories',
    description: 'Create, edit and manage creative categories.',
    path: '/admin/categories',
  },
]

export default function AdminPage() {
  return (
    <main className="bg-admin-bg min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-admin-muted mt-1 text-sm">
            CreAtlantis administration overview.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className="border-admin-border bg-admin-bg rounded-xl border p-6 transition hover:border-blue-500"
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="text-admin-muted mt-2 text-sm">
                {section.description}
              </p>
              <p className="mt-4 text-sm font-medium text-blue-400">
                Open section →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
