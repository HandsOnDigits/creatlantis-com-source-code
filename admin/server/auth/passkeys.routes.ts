import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { db } from '../../src/prisma/db'
import { requireAdminSession } from './middleware/auth.middleware'
import { createPasskeyRegistrationOptions } from './webauthn/passkey-registration.service'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { verifyPasskeyRegistration } from './webauthn/passkey-verification.service'
import { recordAdminAuditEvent } from '../audit/audit.service'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'

import { createPasskeyAuthenticationOptions } from './webauthn/passkey-authentication.service'
import { verifyPasskeyAuthentication } from './webauthn/passkey-authentication-verification.service'

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

passkeyRoutes.post(
  '/registration/verify',
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

      const verified = await verifyPasskeyRegistration(
        auth.adminId,
        auth.sessionId,
        req.body as RegistrationResponseJSON,
      )

      if (!verified) {
        res.status(400).json({
          error: 'Passkey registration could not be verified.',
        })
        return
      }

      await recordAdminAuditEvent({
        adminId: auth.adminId,
        event: 'ADMIN_PASSKEY_REGISTERED',
        targetType: 'ADMIN_ACCOUNT',
        targetId: auth.adminId,
      })

      res.setHeader('Cache-Control', 'no-store')

      res.json({
        success: true,
        mfaVerified: true,
      })
    } catch (error) {
      next(error)
    }
  },
)

passkeyRoutes.post(
  '/authentication/options',
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

      const options = await createPasskeyAuthenticationOptions(
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

passkeyRoutes.post(
  '/authentication/verify',
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

      const verified = await verifyPasskeyAuthentication(
        auth.adminId,
        auth.sessionId,
        req.body as AuthenticationResponseJSON,
      )

      if (!verified) {
        res.status(400).json({
          error: 'Passkey authentication could not be verified.',
        })
        return
      }

      await recordAdminAuditEvent({
        adminId: auth.adminId,
        event: 'ADMIN_PASSKEY_AUTHENTICATED',
        targetType: 'ADMIN_ACCOUNT',
        targetId: auth.adminId,
      })

      res.setHeader('Cache-Control', 'no-store')

      res.status(200).json({
        success: true,
        mfaVerified: true,
      })
    } catch (error) {
      next(error)
    }
  },
)

export default passkeyRoutes
