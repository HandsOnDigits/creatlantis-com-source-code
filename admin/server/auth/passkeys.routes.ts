import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { db } from '../../src/prisma/db'
import { requireAdminSession } from './middleware/auth.middleware'
import { createPasskeyRegistrationOptions } from './webauthn/passkey-registration.service'

const passkeyRoutes = Router()

const passkeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many passkey attempts. Please try again later.',
  },
})

passkeyRoutes.post(
  '/registration/options',
  passkeyLimiter,
  requireAdminSession,
  async (req, res, next) => {
    try {
      const auth = req.adminAuth

      if (!auth) {
        res.status(401).json({
          error: 'Authentication required.',
        })
        return
      }

      const [mfa, passkeys] = await Promise.all([
        db.orm.public.AdminMfa.where({
          adminId: auth.adminId,
        }).first(),

        db.orm.public.AdminPasskey.where({
          adminId: auth.adminId,
        }).all(),
      ])

      const hasTotp = mfa?.enabledAt != null
      const hasPasskeys = passkeys.length > 0

      if ((hasTotp || hasPasskeys) && !auth.mfaVerified) {
        res.status(403).json({
          error: 'Existing MFA verification is required.',
          code: 'MFA_REQUIRED',
        })
        return
      }

      const options = await createPasskeyRegistrationOptions(
        auth.adminId,
        auth.sessionId,
      )

      res.setHeader('Cache-Control', 'no-store')

      res.status(200).json(options)
    } catch (error) {
      next(error)
    }
  },
)

export default passkeyRoutes
