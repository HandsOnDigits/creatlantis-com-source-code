import { db } from '../../src/prisma/db'

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { confirmMfaEnrollment } from './services/mfa-confirmation.service'
import { requireAdminSession } from './middleware/auth.middleware'
import { startMfaEnrollment } from './services/mfa-enrollment.service'
import { verifyAdminMfa } from './services/mfa-verification.service'
import { verifyRecoveryCode } from './services/recovery-codes.service'

const mfaRoutes = Router()

const confirmEnrollmentSchema = z.object({
  token: z.string().regex(/^\d{6}$/),
})

const mfaConfirmationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many MFA attempts. Please try again later.',
  },
})

const recoveryCodeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
})

mfaRoutes.post('/enrollment', requireAdminSession, async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.adminId

    if (!adminId) {
      res.status(401).json({
        error: 'Authentication required.',
      })
      return
    }

    const admin = await db.orm.public.AdminAccount.whereUnique({
      id: adminId,
    }).first()

    if (!admin || !admin.active || admin.disabledAt !== null) {
      res.status(401).json({
        error: 'Authentication required.',
      })
      return
    }

    const enrollment = await startMfaEnrollment(adminId, admin.email)

    res.setHeader('Cache-Control', 'no-store')

    res.status(200).json({
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      secret: enrollment.secret,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'MFA is already enabled.') {
      res.status(409).json({
        error: error.message,
      })
      return
    }

    next(error)
  }
})

mfaRoutes.post(
  '/enrollment/confirm',
  mfaConfirmationLimiter,
  requireAdminSession,
  async (req, res, next) => {
    try {
      const parsed = confirmEnrollmentSchema.safeParse(req.body)

      if (!parsed.success) {
        res.status(400).json({
          error: 'A valid six-digit MFA code is required.',
        })
        return
      }

      const auth = req.adminAuth

      if (!auth) {
        res.status(401).json({
          error: 'Authentication required.',
        })
        return
      }

      const confirmed = await confirmMfaEnrollment(
        auth.adminId,
        auth.sessionId,
        parsed.data.token,
      )

      if (!confirmed) {
        res.status(400).json({
          error: 'MFA verification failed. Check the code and try again.',
        })
        return
      }

      res.setHeader('Cache-Control', 'no-store')

      res.status(200).json({
        success: true,
        mfaEnabled: true,
      })
    } catch (error) {
      next(error)
    }
  },
)

mfaRoutes.post(
  '/verification',
  mfaConfirmationLimiter,
  requireAdminSession,
  async (req, res, next) => {
    try {
      const parsed = confirmEnrollmentSchema.safeParse(req.body)

      if (!parsed.success) {
        res.status(400).json({
          error: 'A valid six-digit MFA code is required.',
        })
        return
      }

      const auth = req.adminAuth

      if (!auth) {
        res.status(401).json({
          error: 'Authentication required.',
        })
        return
      }

      const verified = await verifyAdminMfa(
        auth.adminId,
        auth.sessionId,
        parsed.data.token,
      )

      if (!verified) {
        res.status(400).json({
          error: 'MFA verification failed. Check the code and try again.',
        })
        return
      }

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

mfaRoutes.post(
  '/recovery',
  mfaConfirmationLimiter,
  requireAdminSession,
  async (req, res, next) => {
    try {
      const parsed = recoveryCodeSchema.safeParse(req.body)

      if (!parsed.success) {
        res.status(400).json({
          error: 'A valid recovery code is required.',
        })
        return
      }

      const auth = req.adminAuth

      if (!auth) {
        res.status(401).json({
          error: 'Authentication required.',
        })
        return
      }

      const verified = await verifyRecoveryCode(
        auth.adminId,
        auth.sessionId,
        parsed.data.code,
      )

      if (!verified) {
        res.status(400).json({
          error: 'Recovery code verification failed.',
        })
        return
      }

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

export default mfaRoutes
