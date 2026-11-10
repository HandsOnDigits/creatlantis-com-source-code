import type { NextFunction, Request, Response } from 'express'

export function requireModerator(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.adminAuth) {
    res.status(401).json({
      error: 'Authentication required.',
    })

    return
  }

  if (req.adminAuth.role !== 'MODERATOR' && req.adminAuth.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Insufficient permissions.',
    })

    return
  }

  next()
}
