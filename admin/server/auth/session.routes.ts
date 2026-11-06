import { Router } from 'express'

import { requireMfaVerifiedAdmin } from './middleware/auth.middleware'
import { listAdminSessions } from './services/session-management.service'
import { revokeAdminSessionById } from './services/session-management.service'
import { revokeOtherAdminSessions } from './services/session-management.service'
import { recordAdminAuditEvent } from '../audit/audit.service'

const sessionRoutes = Router()

sessionRoutes.get('/', requireMfaVerifiedAdmin, async (req, res, next) => {
  try {
    const auth = req.adminAuth

    if (!auth) {
      res.status(401).json({
        error: 'Authentication required.',
      })
      return
    }

    const sessions = await listAdminSessions(auth.adminId, auth.sessionId)

    res.setHeader('Cache-Control', 'no-store')

    res.status(200).json({
      sessions,
    })
  } catch (error) {
    next(error)
  }
})

sessionRoutes.delete(
  '/:sessionId',
  requireMfaVerifiedAdmin,
  async (req, res, next) => {
    try {
      const auth = req.adminAuth

      if (!auth) {
        res.status(401).json({
          error: 'Authentication required.',
        })
        return
      }

      const sessionId = req.params.sessionId

      if (typeof sessionId !== 'string') {
        res.status(400).json({
          error: 'Invalid session ID.',
        })
        return
      }

      const revoked = await revokeAdminSessionById(
        auth.adminId,
        sessionId,
        auth.sessionId,
      )

      if (!revoked) {
        res.status(404).json({
          error: 'Session not found.',
        })
        return
      }

      await recordAdminAuditEvent({
        adminId: auth.adminId,
        event: 'ADMIN_SESSION_REVOKED',
        targetType: 'ADMIN_SESSION',
        targetId: sessionId,
      })

      res.status(200).json({
        success: true,
      })
    } catch (error) {
      next(error)
    }
  },
)

sessionRoutes.post(
  '/revoke-others',
  requireMfaVerifiedAdmin,
  async (req, res, next) => {
    try {
      const auth = req.adminAuth

      if (!auth) {
        res.status(401).json({
          error: 'Authentication required.',
        })
        return
      }

      const revokedCount = await revokeOtherAdminSessions(
        auth.adminId,
        auth.sessionId,
      )

      await recordAdminAuditEvent({
        adminId: auth.adminId,
        event: 'ADMIN_OTHER_SESSIONS_REVOKED',
        targetType: 'ADMIN_SESSIONS',
      })

      res.status(200).json({
        success: true,
        revokedCount,
      })
    } catch (error) {
      next(error)
    }
  },
)

export default sessionRoutes
