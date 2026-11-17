import bbobHTML from '@bbob/html'
import presetHTML5 from '@bbob/preset-html5'
import sanitizeHtml from 'sanitize-html'

const MAX_PROFILE_BBCODE_LENGTH = 20_000

const preset = presetHTML5()

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'span',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],

  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style'],
  },

  allowedSchemes: ['http', 'https', 'mailto'],

  allowedSchemesByTag: {
    img: ['https'],
  },

  allowProtocolRelative: false,

  allowedStyles: {
    '*': {
      color: [
        /^#[0-9a-fA-F]{3,8}$/,
        /^rgb\([0-9\s.,%]+\)$/,
        /^rgba\([0-9\s.,%]+\)$/,
        /^[a-zA-Z]+$/,
      ],
      'background-color': [
        /^#[0-9a-fA-F]{3,8}$/,
        /^rgb\([0-9\s.,%]+\)$/,
        /^rgba\([0-9\s.,%]+\)$/,
        /^[a-zA-Z]+$/,
      ],
      'font-size': [/^[0-9.]+(px|em|rem|%)$/],
      'font-family': [/^[a-zA-Z0-9\s,"'-]+$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic|oblique)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
    },
  },

  transformTags: {
    a: sanitizeHtml.simpleTransform(
      'a',
      {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
      true,
    ),
  },
}

/**
 * Converts BBCode into sanitized HTML.
 *
 * Always call this function on the server.
 */
export function renderProfileBBCode(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Profile BBCode must be a string.')
  }

  if (input.length > MAX_PROFILE_BBCODE_LENGTH) {
    throw new Error('Profile BBCode exceeds the maximum allowed length.')
  }

  const rendered = bbobHTML(input, preset, {
    caseFreeTags: true,
    enableEscapeTags: true,
  })

  return sanitizeHtml(rendered, sanitizeOptions)
}
