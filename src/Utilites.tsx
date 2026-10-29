import default_pp from './assets/images/default_pp.webp'

interface profileURL {
  name: string
}

export function ProfileLink({ name }: profileURL) {
  return (
    <a href={name} className="flex h-auto max-w-14 items-center gap-2">
      <img src={default_pp} /> <p>{name}</p>
    </a>
  )
}

/* Divide lines */

export function VerticalHR() {
  return <div className="border-vr-line h-12 border-l-3"></div>
}

export function HorizontalHR() {
  return <div className="border-hr-line my-3 border-b-3"></div>
}
