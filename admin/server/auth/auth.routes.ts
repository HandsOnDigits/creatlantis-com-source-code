import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { authenticateAdminPassword } from './services/auth.service'
import {
  clearAdminSessionCookie,
  getAdminSessionCookieName,
  setAdminSessionCookie,
} from './auth.cookies'
import { adminLoginSchema } from './schemas/auth.schemas'
import { getAdminSession, revokeAdminSession } from './services/admin-session'
import { recordAdminAuditEvent } from '../audit/audit.service'

import { db } from '../../src/prisma/db'
import { requireAdminSession } from './middleware/auth.middleware'

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

    await recordAdminAuditEvent({
      adminId: result.admin.id,
      event: 'ADMIN_PASSWORD_AUTHENTICATED',
      targetType: 'ADMIN_ACCOUNT',
      targetId: result.admin.id,
    })

    setAdminSessionCookie(res, result.token)

    res.status(200).json({
      admin: result.admin,
      nextStep: result.nextStep,
      availableMethods: result.availableMethods,
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.get('/session', requireAdminSession, async (req, res, next) => {
  try {
    const auth = req.adminAuth

    if (!auth) {
      res.status(401).json({
        error: 'Authentication required.',
      })
      return
    }

    const admin = await db.orm.public.AdminAccount.whereUnique({
      id: auth.adminId,
    }).first()

    if (!admin || !admin.active || admin.disabledAt !== null) {
      res.status(401).json({
        error: 'Authentication required.',
      })
      return
    }

    const [selection, mfa, passkeys] = await Promise.all([
      db.orm.public.AdminMfaMethodSelection.whereUnique({
        adminId: admin.id,
      }).first(),

      db.orm.public.AdminMfa.whereUnique({
        adminId: admin.id,
      }).first(),

      db.orm.public.AdminPasskey.where({
        adminId: admin.id,
      }).all(),
    ])

    // Existing MFA configuration without a persistent selection
    // indicates inconsistent database state.
    if (!selection && (mfa !== null || passkeys.length > 0)) {
      res.status(403).json({
        error: 'MFA configuration is inconsistent.',
        code: 'MFA_CONFIGURATION_INVALID',
      })
      return
    }

    let mfaEnabled = false
    let availableMethods: ('TOTP' | 'PASSKEY')[] = []

    if (selection?.method === 'TOTP') {
      if (passkeys.length > 0) {
        res.status(403).json({
          error: 'MFA configuration is inconsistent.',
          code: 'MFA_CONFIGURATION_INVALID',
        })
        return
      }

      availableMethods = ['TOTP']

      mfaEnabled = Boolean(
        mfa?.enabledAt &&
        mfa.secretCiphertext &&
        mfa.secretNonce &&
        mfa.secretAuthTag &&
        mfa.encryptionKeyVersion !== null,
      )
    } else if (selection?.method === 'PASSKEY') {
      if (mfa !== null) {
        res.status(403).json({
          error: 'MFA configuration is inconsistent.',
          code: 'MFA_CONFIGURATION_INVALID',
        })
        return
      }

      availableMethods = ['PASSKEY']
      mfaEnabled = passkeys.length > 0
    }

    const mfaVerified = auth.mfaVerified && mfaEnabled

    res.setHeader('Cache-Control', 'no-store')

    res.status(200).json({
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      mfaEnabled,
      mfaVerified,
      nextStep: !mfaEnabled
        ? 'MFA_ENROLLMENT_REQUIRED'
        : mfaVerified
          ? 'AUTHENTICATED'
          : 'MFA_VERIFICATION_REQUIRED',
      availableMethods,
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post('/logout', async (req, res, next) => {
  try {
    const token: unknown = req.cookies?.[getAdminSessionCookieName()]

    if (token) {
      const session = await getAdminSession(token)

      await revokeAdminSession(token)

      if (session) {
        await recordAdminAuditEvent({
          adminId: session.admin.id,
          event: 'ADMIN_LOGOUT',
          targetType: 'ADMIN_SESSION',
          targetId: session.session.id,
        })
      }
    }

    clearAdminSessionCookie(res)

    res.status(200).json({
      success: true,
    })
  } catch (error) {
    next(error)
  }
})

export default authRoutes
