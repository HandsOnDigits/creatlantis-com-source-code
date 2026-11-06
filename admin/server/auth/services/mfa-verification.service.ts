import { db } from '../../../src/prisma/db'

import { decryptMfaSecret } from './mfa-crypto'
import { verifyTotpCode } from './mfa-totp'
import { verifyAdminSessionMfa } from './admin-session'

export async function verifyAdminMfa(
  adminId: string,
  sessionId: string,
  token: string,
): Promise<boolean> {
  const mfa = await db.orm.public.AdminMfa.whereUnique({ adminId }).first()

  if (
    !mfa ||
    mfa.enabledAt === null ||
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

  // Only one concurrent request can consume this time step.
  const updated = await db.orm.public.AdminMfa.where({
    adminId,
    enabledAt: mfa.enabledAt,
    lastAcceptedTimeStep: mfa.lastAcceptedTimeStep,
  }).update({
    lastAcceptedTimeStep: BigInt(verification.timeStep),
  })

  if (!updated) {
    return false
  }

  return verifyAdminSessionMfa(sessionId, adminId)
}
