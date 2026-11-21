import type { Request, RequestHandler } from 'express'
import { jwtVerify } from 'jose'

export interface ChatAuth {
  userId: number
  identityId: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: ChatAuth
    }
  }
}

const jwtSecret = process.env['JWT_SECRET']

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be configured and at least 32 characters long',
  )
}

const secret = new TextEncoder().encode(jwtSecret)

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const requireChatAuth: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'creatlantis-api',
      audience: 'creatlantis-web',
    })

    const userId = Number(payload.sub)
    const identityId = payload.identityId

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof identityId !== 'string' ||
      !uuidPattern.test(identityId)
    ) {
      res.status(401).json({ error: 'Invalid authentication token' })
      return
    }

    req.auth = { userId, identityId }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token' })
  }
}
