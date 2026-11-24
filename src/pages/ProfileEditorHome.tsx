import { Link } from 'react-router-dom'

import { HorizontalHR } from '../Utilites'

function ProfileEditorHome() {
  const sections = [
    {
      title: 'Profile Layout',
      description: 'Add, remove, reorder and move profile widgets.',
      path: '/profile/edit/layout',
    },
    {
      title: 'BIO',
      description: 'Edit your profile biography.',
      path: '/profile/edit/bio',
    },
    {
      title: 'Custom CSS',
      description: 'Customize the appearance of your profile.',
      path: '/profile/edit/css',
    },
    {
      title: 'Spotlight',
      description: 'Edit the title and content of your Spotlight widgets.',
      path: '/profile/edit/spotlight',
    },
    {
      title: 'Custom Text',
      description: 'Edit the content of your Custom Text widgets.',
      path: '/profile/edit/custom-text',
    },
  ]

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="big-text font-bold">Profile Editor</h1>
        <p className="mt-2 opacity-60">
          Choose which part of your profile you want to customize.
        </p>
        <HorizontalHR />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.path}
            to={section.path}
            className="bg-background-blend rounded border border-current/20 p-5 transition-opacity hover:opacity-60"
          >
            <h2 className="text-lg font-bold">{section.title}</h2>
            <p className="mt-2 text-sm opacity-60">{section.description}</p>
          </Link>
        ))}
      </div>

      <Link to="/" className="underline">
        Back to home
      </Link>
    </main>
  )
}

export default ProfileEditorHome
