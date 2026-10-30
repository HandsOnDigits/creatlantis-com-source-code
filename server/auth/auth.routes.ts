import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { db } from '../../src/prisma/db'
import { loginSchema, registerSchema } from './auth.schemas'
import {
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
} from './auth.service'
import { requireAuth } from './auth.middleware'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
  },
})

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
}

router.post('/register', async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid registration data',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  try {
    const user = await registerUser(parsed.data)

    res.status(201).json({ data: user })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'sqlState' in error &&
      error.sqlState === '23505'
    ) {
      res.status(409).json({
        error: 'Email or username is already taken',
      })
      return
    }

    next(error)
  }
})

// Refresh access token and rotate refresh token
router.post('/refresh', authLimiter, async (req, res) => {
  const refreshToken = req.cookies?.refreshToken

  if (typeof refreshToken !== 'string' || !refreshToken) {
    res.status(401).json({
      error: 'Invalid or expired session',
    })
    return
  }

  const result = await refreshUserSession(refreshToken)

  if (!result) {
    res.clearCookie('refreshToken', refreshCookieOptions)

    res.status(401).json({
      error: 'Invalid or expired session',
    })
    return
  }

  res.cookie('refreshToken', result.refreshToken, {
    ...refreshCookieOptions,
    maxAge:
      Number(process.env['REFRESH_TOKEN_TTL_DAYS'] ?? 30) * 24 * 60 * 60 * 1000,
  })

  res.json({
    data: {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env['ACCESS_TOKEN_TTL'] ?? '15m',
      user: result.user,
    },
  })
})

// Revoke current session
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken

  await logoutUser(typeof refreshToken === 'string' ? refreshToken : undefined)

  res.clearCookie('refreshToken', refreshCookieOptions)

  res.status(204).send()
})

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid login data',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const result = await loginUser(parsed.data)

  if (!result) {
    res.status(401).json({
      error: 'Invalid email or password',
    })
    return
  }

  const refreshTokenTtlDays = Number(
    process.env['REFRESH_TOKEN_TTL_DAYS'] ?? 30,
  )

  res.cookie('refreshToken', result.refreshToken, {
    ...refreshCookieOptions,
    maxAge: refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  })

  res.json({
    data: {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env['ACCESS_TOKEN_TTL'] ?? '15m',
      user: result.user,
    },
  })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await db.orm.public.User.where({ id: req.auth!.userId })
    .select('id', 'email', 'username', 'name', 'nameIsPublic', 'createdAt')
    .first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({ data: user })
})

export default router
