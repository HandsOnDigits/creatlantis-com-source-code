import type { NextFunction, Request, Response } from 'express'

import { getAdminSession } from '../services/admin-session'
import {
  clearAdminSessionCookie,
  getAdminSessionCookieName,
} from '../auth.cookies'

declare global {
  namespace Express {
    interface Request {
      adminAuth?: {
        adminId: string
        sessionId: string
        role: string
        mfaVerified: boolean
      }
    }
  }
}

async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
  requireMfa: boolean,
): Promise<void> {
  try {
    const token: unknown = req.cookies?.[getAdminSessionCookieName()]

    const result = await getAdminSession(token)

    if (!result) {
      clearAdminSessionCookie(res)

      res.status(401).json({
        error: 'Authentication required.',
      })

      return
    }

    if (requireMfa && !result.mfaVerified) {
      res.status(403).json({
        error: 'MFA verification required.',
        code: 'MFA_REQUIRED',
      })

      return
    }

    req.adminAuth = {
      adminId: result.admin.id,
      sessionId: result.session.id,
      role: result.admin.role,
      mfaVerified: result.mfaVerified,
    }

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Requires a valid admin session.
 * Allows sessions that have not completed MFA.
 * Use for MFA enrollment and verification endpoints.
 */
export function requireAdminSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return authenticateAdmin(req, res, next, false)
}

/**
 * Requires a valid admin session with completed MFA.
 * Use for all protected admin functionality.
 */
export function requireMfaVerifiedAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return authenticateAdmin(req, res, next, true)
}
