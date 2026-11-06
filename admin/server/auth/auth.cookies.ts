import type { CookieOptions, Response } from 'express'

const COOKIE_NAME =
  process.env['ADMIN_SESSION_COOKIE'] ?? '__Host-creatlantis_admin'

const isProduction = process.env['NODE_ENV'] === 'production'

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
}

if (!isProduction && COOKIE_NAME.startsWith('__Host-')) {
  // __Host- cookies require Secure, even during local development.
  // Use a non-prefixed cookie name for HTTP localhost.
}

export function setAdminSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, cookieOptions)
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  })
}

export function getAdminSessionCookieName(): string {
  return COOKIE_NAME
}
