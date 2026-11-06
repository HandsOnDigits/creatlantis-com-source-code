import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { authenticateAdminPassword } from './services/auth.service'
import { setAdminSessionCookie } from './auth.cookies'
import { adminLoginSchema } from './schemas/auth.schemas'

const authRoutes = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again later.',
  },
})

authRoutes.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid login request.',
      })
      return
    }

    const result = await authenticateAdminPassword(
      parsed.data.email,
      parsed.data.password,
    )

    if (!result.success) {
      res.status(401).json({
        error: 'Invalid email or password.',
      })
      return
    }

    setAdminSessionCookie(res, result.token)

    res.status(200).json({
      admin: result.admin,
      nextStep: result.nextStep,
    })
  } catch (error) {
    next(error)
  }
})

export default authRoutes
