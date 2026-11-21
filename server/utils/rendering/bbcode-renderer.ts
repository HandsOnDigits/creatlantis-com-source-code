import bbobHTML from '@bbob/html'
import presetHTML5 from '@bbob/preset-html5'

import { sanitizeHTML } from './html-sanitizer'

const MAX_BBCODE_LENGTH = 100_000

const preset = presetHTML5()

/**
 * Converts BBCode into HTML without sanitizing.
 *
 * Intended for internal use by the rendering pipeline.
 */
export function convertBBCode(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('BBCode input must be a string.')
  }

  if (input.length > MAX_BBCODE_LENGTH) {
    throw new Error('BBCode exceeds the maximum allowed length.')
  }

  return bbobHTML(input, preset, {
    caseFreeTags: true,
    enableEscapeTags: true,
  })
}

/**
 * Converts BBCode into sanitized HTML.
 */
export function renderBBCode(input: string): string {
  return sanitizeHTML(convertBBCode(input))
}
