import sanitizeHtml from 'sanitize-html'

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
 * Sanitizes HTML using the shared CreAtlantis HTML policy.
 *
 * Always call this function on the server.
 */
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('HTML input must be a string.')
  }

  return sanitizeHtml(input, sanitizeOptions)
}
