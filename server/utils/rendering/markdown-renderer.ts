import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: true,
  breaks: false,
  linkify: false,
  typographer: false,
})

/**
 * Converts Markdown into HTML.
 *
 * Raw HTML is temporarily permitted because the unified
 * rendering pipeline sanitizes the final output.
 */
export function renderMarkdown(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Markdown input must be a string.')
  }

  return markdown.render(input)
}
