import type { PostImageVariant } from './api'

// --- Journal Component ---
export function Journal({ content }: { content: string }) {
  return (
    <div
      className="journal h-[40vh] overflow-y-scroll p-4 leading-relaxed sm:h-[65vh] md:h-[40vh]"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

// --- Responsive B2 Image Component ---
export function Image({
  variants,
  alt,
}: {
  variants: PostImageVariant[]
  alt: string
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
    <picture>
      {avif.length > 0 && (
        <source
          type="image/avif"
          srcSet={makeSrcSet(avif)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      )}

      {webp.length > 0 && (
        <source
          type="image/webp"
          srcSet={makeSrcSet(webp)}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      )}

      <img
        src={fallback.url}
        alt={alt}
        width={fallback.width}
        height={fallback.height}
        className="w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}
