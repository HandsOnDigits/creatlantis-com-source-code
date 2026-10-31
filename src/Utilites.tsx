import default_pp from './assets/images/default_pp.webp'

interface profileURL {
  name: string
}

export function ProfileLink({ name }: profileURL) {
  return (
    <a href={name} className="user-profile items-cente flex">
      <img className="h-auto max-w-14" src={default_pp} />
      <p className="p-4">{name}</p>
    </a>
  )
}

/* Divide lines */

export function VerticalHR() {
  return <div className="border-vr-line h-12 border-l-3"></div>
}

export function HorizontalHR() {
  return <div className="border-hr-line my-3 w-[90%] border-b-3"></div>
}
