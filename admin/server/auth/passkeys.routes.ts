import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'

import { db } from '../../src/prisma/db'
import { requireAdminSession } from '../middleware/auth.middleware'

import { createPasskeyRegistrationOptions } from './webauthn/passkey-registration.service'
import { verifyPasskeyRegistration } from './webauthn/passkey-verification.service'

import { createPasskeyAuthenticationOptions } from './webauthn/passkey-authentication.service'
import { verifyPasskeyAuthentication } from './webauthn/passkey-authentication-verification.service'

import { recordAdminAuditEvent } from '../audit/audit.service'

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

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const MAX_ID_LENGTH = 2048
const MAX_CLIENT_DATA_LENGTH = 16_384
const MAX_AUTHENTICATOR_DATA_LENGTH = 16_384
const MAX_SIGNATURE_LENGTH = 16_384
const MAX_ATTESTATION_OBJECT_LENGTH = 65_536

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBase64Url(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    BASE64URL_PATTERN.test(value)
  )
}

function isRegistrationResponse(
  value: unknown,
): value is RegistrationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) {
    return false
  }

  const response = value.response

  if (
    !isBase64Url(value.id, MAX_ID_LENGTH) ||
    !isBase64Url(value.rawId, MAX_ID_LENGTH) ||
    value.id !== value.rawId ||
    value.type !== 'public-key' ||
    !isRecord(value.clientExtensionResults) ||
    !isBase64Url(response.clientDataJSON, MAX_CLIENT_DATA_LENGTH) ||
    !isBase64Url(response.attestationObject, MAX_ATTESTATION_OBJECT_LENGTH)
  ) {
    return false
  }

  if (
    response.transports !== undefined &&
    (!Array.isArray(response.transports) ||
      !response.transports.every(
        (transport) =>
          typeof transport === 'string' &&
          ['ble', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'].includes(
            transport,
          ),
      ))
  ) {
    return false
  }

  if (
    value.authenticatorAttachment !== undefined &&
    value.authenticatorAttachment !== null &&
    value.authenticatorAttachment !== 'platform' &&
    value.authenticatorAttachment !== 'cross-platform'
  ) {
    return false
  }

  return true
}

function isAuthenticationResponse(
  value: unknown,
): value is AuthenticationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) {
    return false
  }

  const response = value.response

  if (
    !isBase64Url(value.id, MAX_ID_LENGTH) ||
    !isBase64Url(value.rawId, MAX_ID_LENGTH) ||
    value.id !== value.rawId ||
    value.type !== 'public-key' ||
    !isRecord(value.clientExtensionResults) ||
    !isBase64Url(response.clientDataJSON, MAX_CLIENT_DATA_LENGTH) ||
    !isBase64Url(response.authenticatorData, MAX_AUTHENTICATOR_DATA_LENGTH) ||
    !isBase64Url(response.signature, MAX_SIGNATURE_LENGTH)
  ) {
    return false
  }

  if (
    response.userHandle !== undefined &&
    response.userHandle !== null &&
    !isBase64Url(response.userHandle, MAX_ID_LENGTH)
  ) {
    return false
  }

  if (
    value.authenticatorAttachment !== undefined &&
    value.authenticatorAttachment !== null &&
    value.authenticatorAttachment !== 'platform' &&
    value.authenticatorAttachment !== 'cross-platform'
  ) {
    return false
  }

  return true
}

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

      if (mfa !== null) {
        res.status(409).json({
          error:
            'A TOTP configuration already exists. Passkey enrollment is unavailable.',
          code: 'MFA_METHOD_CONFLICT',
        })
        return
      }

      const hasPasskeys = passkeys.length > 0

      if (hasPasskeys && !auth.mfaVerified) {
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

      if (!isRegistrationResponse(req.body)) {
        res.status(400).json({
          error: 'Invalid passkey registration response.',
        })
        return
      }

      const existingMfa = await db.orm.public.AdminMfa.where({
        adminId: auth.adminId,
      }).first()

      if (existingMfa !== null) {
        res.status(409).json({
          error:
            'A TOTP configuration already exists. Passkey enrollment is unavailable.',
          code: 'MFA_METHOD_CONFLICT',
        })
        return
      }

      const verified = await verifyPasskeyRegistration(
        auth.adminId,
        auth.sessionId,
        req.body,
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

      if (!isAuthenticationResponse(req.body)) {
        res.status(400).json({
          error: 'Invalid passkey authentication response.',
        })
        return
      }

      const verified = await verifyPasskeyAuthentication(
        auth.adminId,
        auth.sessionId,
        req.body,
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
