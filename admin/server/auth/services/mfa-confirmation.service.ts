import { db } from '../../../src/prisma/db'

import { decryptMfaSecret } from './mfa-crypto'
import { verifyTotpCode } from './mfa-totp'
import { verifyAdminSessionMfa } from './admin-session'

export async function confirmMfaEnrollment(
  adminId: string,
  sessionId: string,
  token: string,
): Promise<boolean> {
  const mfa = await db.orm.public.AdminMfa.whereUnique({ adminId }).first()

  if (
    !mfa ||
    mfa.enabledAt !== null ||
    !mfa.secretCiphertext ||
    !mfa.secretNonce ||
    !mfa.secretAuthTag ||
    mfa.encryptionKeyVersion === null
  ) {
    return false
  }

  const secret = decryptMfaSecret(
    mfa.secretCiphertext,
    mfa.secretNonce,
    mfa.secretAuthTag,
    mfa.encryptionKeyVersion,
  )

  const verification = await verifyTotpCode(
    secret,
    token,
    mfa.lastAcceptedTimeStep,
  )

  if (!verification.valid || verification.timeStep === null) {
    return false
  }

  // Compare-and-set prevents two concurrent requests from
  // accepting the same TOTP time step.
  const updated = await db.orm.public.AdminMfa.where({
    adminId,
    enabledAt: null,
    lastAcceptedTimeStep: mfa.lastAcceptedTimeStep,
  }).update({
    enabledAt: new Date().toISOString(),
    lastAcceptedTimeStep: BigInt(verification.timeStep),
  })

  if (!updated) {
    return false
  }

  return verifyAdminSessionMfa(sessionId, adminId)
}
