import { useEffect, useRef } from 'react'

function ProfileContent({ html }: { html: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host {
        display: block;
        color: inherit;
        font-family: inherit;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      a {
        color: inherit;
        text-decoration: underline;
      }

      table {
        max-width: 100%;
        border-collapse: collapse;
      }
    `

    const content = document.createElement('div')
    content.innerHTML = html

    shadow.replaceChildren(style, content)

    return () => {
      shadow.replaceChildren()
    }
  }, [html])

  return <div ref={hostRef} className="w-full" />
}

export default ProfileContent
