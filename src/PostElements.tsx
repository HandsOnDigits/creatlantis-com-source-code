import type { PostImageVariant } from './api'

// --- Journal Component ---
export function Journal({ content }: { content: string }) {
  return (
    <div
      className="journal post h-[40vh] overflow-y-scroll p-4 leading-relaxed sm:h-[65vh] md:h-[40vh]"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

// --- Responsive B2 Image Component ---
export function Image({
  variants,
  alt,
  onClick,
  className = '',
}: {
  variants: PostImageVariant[]
  alt: string
  onClick?: () => void
  className?: string
}) {
  const webp = variants
    .filter((variant) => variant.format === 'WEBP')
    .sort((a, b) => a.width - b.width)

  const avif = variants
    .filter((variant) => variant.format === 'AVIF')
    .sort((a, b) => a.width - b.width)

  const fallback = webp.at(-1) ?? avif.at(-1)

  if (!fallback) return null

  const makeSrcSet = (items: PostImageVariant[]) =>
    items.map((item) => `${item.url} ${item.width}w`).join(', ')

  return (
    <picture className="post block max-w-full overflow-hidden">
      {avif.length > 0 && (
        <source
          type="image/avif"
          srcSet={makeSrcSet(avif)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 70vw"
        />
      )}

      {webp.length > 0 && (
        <source
          type="image/webp"
          srcSet={makeSrcSet(webp)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 70vw"
        />
      )}

      <img
        src={fallback.url}
        alt={alt}
        width={fallback.width}
        height={fallback.height}
        loading="lazy"
        decoding="async"
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick()
                }
              }
            : undefined
        }
        className={`mx-auto block max-h-[75vh] w-auto max-w-full object-contain ${
          onClick ? 'cursor-zoom-in' : ''
        } ${className}`}
      />
    </picture>
  )
}
