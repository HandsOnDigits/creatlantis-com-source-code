import type { RequestHandler } from 'express'
import { jwtVerify } from 'jose'

const jwtSecret = process.env['JWT_SECRET']

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters')
}

const secret = new TextEncoder().encode(jwtSecret)

export interface AuthenticatedRequest {
  userId: number
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedRequest
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = authorization.slice('Bearer '.length)

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'creatlantis-api',
      audience: 'creatlantis-web',
      algorithms: ['HS256'],
    })

    const subject = payload.sub

    if (typeof subject !== 'string' || !/^[1-9]\d*$/.test(subject)) {
      res.status(401).json({ error: 'Invalid access token' })
      return
    }

    const userId = Number(subject)

    if (!Number.isSafeInteger(userId)) {
      res.status(401).json({ error: 'Invalid access token' })
      return
    }

    req.auth = { userId }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' })
  }
}
