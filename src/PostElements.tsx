// --- Journal Component (renders filtered HTML content) ---
export function Journal({ content }: { content: string }) {
  return (
    <div
      className="journal h-[40vh] w-fit overflow-y-scroll p-4 leading-relaxed sm:h-[65vh]"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

// --- Image Component ---
export function Image({ url, alt }: { url: string; alt: string }) {
  return <img src={url} alt={alt} className="w-full object-cover" />
}
