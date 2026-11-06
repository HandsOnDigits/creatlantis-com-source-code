import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32

export function createSessionToken() {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')

  return {
    token,
    tokenHash: hashSessionToken(token),
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidSessionToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}
