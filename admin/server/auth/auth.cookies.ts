import type { CookieOptions, Response } from 'express'

const isProduction = process.env['NODE_ENV'] === 'production'

const COOKIE_NAME =
  process.env['ADMIN_SESSION_COOKIE'] ??
  (isProduction ? '__Host-creatlantis_admin' : 'creatlantis_admin')

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/',
  maxAge:
    Number(process.env['ADMIN_SESSION_TTL_DAYS'] ?? 1) * 24 * 60 * 60 * 1000,
}

if (isProduction && !COOKIE_NAME.startsWith('__Host-')) {
  throw new Error(
    'Production admin session cookie must use the __Host- prefix.',
  )
}

export function setAdminSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, cookieOptions)
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  })
}

export function getAdminSessionCookieName(): string {
  return COOKIE_NAME
}
