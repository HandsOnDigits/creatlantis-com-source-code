interface ProtectedCode {
  token: string
  html: string
}

export interface CodeProtectionResult {
  input: string
  restore: (html: string) => string
}

function escapeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Protects Markdown code fences and inline code from other renderers.
 */

export function protectCode(input: string): CodeProtectionResult {
  const protectedBlocks: ProtectedCode[] = []

  let prefix = 'CREATLANTISPROTECTEDCODE'

  while (input.includes(prefix)) {
    prefix += 'X'
  }

  function protect(html: string): string {
    const token = `${prefix}${protectedBlocks.length}END`

    protectedBlocks.push({ token, html })

    return token
  }

  // Protect BBCode code blocks.
  let protectedInput = input.replace(
    /\[code\]([\s\S]*?)\[\/code\]/gi,
    (_match, content: string) =>
      protect(`<pre><code>${escapeHTML(content)}</code></pre>`),
  )

  // Protect fenced code blocks.
  protectedInput = protectedInput.replace(
    /(^|\n)( {0,3})(`{3,}|~{3,})([^\r\n]*)\r?\n([\s\S]*?)\r?\n\2(`{3,}|~{3,})[ \t]*(?=\r?\n|$)/gm,
    (
      match,
      lineStart: string,
      _indent: string,
      opening: string,
      _info: string,
      content: string,
      closing: string,
    ) => {
      if (opening[0] !== closing[0] || closing.length < opening.length) {
        return match
      }

      return `${lineStart}${protect(
        `<pre><code>${escapeHTML(content)}</code></pre>`,
      )}`
    },
  )

  // Protect inline code spans.
  protectedInput = protectedInput.replace(
    /(^|[^`])(`+)(?!`)([\s\S]*?)\2(?!`)/g,
    (match, preceding: string, _delimiter: string, content: string) => {
      return `${preceding}${protect(`<code>${escapeHTML(content)}</code>`)}`
    },
  )

  return {
    input: protectedInput,

    restore(html: string): string {
      let restored = html

      for (const block of protectedBlocks) {
        restored = restored
          .replace(`<p>${block.token}</p>`, block.html)
          .split(block.token)
          .join(block.html)
      }

      return restored
        .replace(/<p>\s*<\/p>(?=\s*<pre><code>)/g, '')
        .replace(/(<\/pre>)\s*<p>\s*<\/p>/g, '$1')
    },
  }
}
