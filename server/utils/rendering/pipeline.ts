import { convertBBCode } from './bbcode-renderer'
import { protectCode } from './code-protection'
import { renderMarkdown } from './markdown-renderer'
import { sanitizeHTML } from './html-sanitizer'
import {
  DEFAULT_RENDER_CONTEXT,
  RENDER_CONTEXT_LIMITS,
  type RenderOptions,
} from './types'

interface ProtectedTag {
  token: string
  tag: string
}

function protectBBCodeTags(input: string): {
  input: string
  restore: (value: string) => string
} {
  const protectedTags: ProtectedTag[] = []

  let prefix = 'CREATLANTISPROTECTEDTAG'

  while (input.includes(prefix)) {
    prefix += 'X'
  }

  const protectedInput = input.replace(
    /\[(\/?)(quote|code|list|ul|ol|table|tr|td|th|\*)(?:=([^\]]*))?\]/gi,
    (match) => {
      const token = `${prefix}${protectedTags.length}END`

      protectedTags.push({ token, tag: match })

      return token
    },
  )

  return {
    input: protectedInput,

    restore(value: string): string {
      let restored = value

      for (const item of protectedTags) {
        restored = restored.split(item.token).join(item.tag)
      }

      return restored
    },
  }
}

/**
 * Automatically renders mixed BBCode, Markdown, HTML and plain text.
 *
 * Code blocks are protected from syntax conversion.
 * BBCode structural tags are protected during Markdown parsing.
 * All generated HTML is sanitized before being returned.
 */
export function renderContent(
  input: string,
  _options: RenderOptions = {},
): string {
  if (typeof input !== 'string') {
    throw new TypeError('Rendering input must be a string.')
  }

  const context = _options.context ?? DEFAULT_RENDER_CONTEXT
  const maxLength = RENDER_CONTEXT_LIMITS[context]

  if (input.length > maxLength) {
    throw new Error(
      `Rendering input exceeds the maximum allowed length for ${context} content (${maxLength} characters).`,
    )
  }

  const protectedCode = protectCode(input)
  const protectedTags = protectBBCodeTags(protectedCode.input)

  const markdownRendered = renderMarkdown(protectedTags.input)
  const restoredTags = protectedTags.restore(markdownRendered)

  const bbcodeConverted = convertBBCode(restoredTags)
  const restoredCode = protectedCode.restore(bbcodeConverted)

  const cleaned = restoredCode
    .replace(/<p>\s*(?=<blockquote\b)/gi, '')
    .replace(/<\/blockquote>\s*<\/p>/gi, '</blockquote>')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p>\s*(?=<\/?(?:ul|ol|table)\b)/gi, '')
    .replace(/<\/(?:ul|ol|table)>\s*<\/p>/gi, (match) =>
      match.replace(/<\/p>/i, ''),
    )

  return sanitizeHTML(cleaned)
}
