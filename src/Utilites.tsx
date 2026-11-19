import default_pp from './assets/images/default_pp.webp'

interface profileURL {
  name: string
  image?: string | null
  tagline?: string | null
}

export function ProfileIcon({ name, image, tagline }: profileURL) {
  return (
    <div className="user-profile inline-flex items-center">
      <img className="h-auto max-w-14" src={image ?? default_pp} alt="" />

      <div className="p-4">
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
