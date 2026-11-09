import { db } from '../../../src/prisma/db'

import {
  createSessionToken,
  hashSessionToken,
  isValidSessionToken,
} from './session-token'

const SESSION_TTL_DAYS = Number(process.env['ADMIN_SESSION_TTL_DAYS'] ?? 1)

if (!Number.isFinite(SESSION_TTL_DAYS) || SESSION_TTL_DAYS <= 0) {
  throw new Error('ADMIN_SESSION_TTL_DAYS must be positive.')
}

function getExpirationDate(): string {
  return new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
}

function isExpired(expiresAt: string): boolean {
  const timestamp = Date.parse(expiresAt)

  return !Number.isFinite(timestamp) || timestamp <= Date.now()
}

async function isSelectedMfaMethodReady(adminId: string): Promise<boolean> {
  const [selection, mfa, passkeys] = await Promise.all([
    db.orm.public.AdminMfaMethodSelection.whereUnique({
      adminId,
    }).first(),

    db.orm.public.AdminMfa.whereUnique({
      adminId,
    }).first(),

    db.orm.public.AdminPasskey.where({
      adminId,
    }).all(),
  ])

  if (!selection) {
    return false
  }

  if (selection.method === 'TOTP') {
    return Boolean(
      passkeys.length === 0 &&
      mfa?.enabledAt &&
      mfa.secretCiphertext &&
      mfa.secretNonce &&
      mfa.secretAuthTag &&
      mfa.encryptionKeyVersion !== null,
    )
  }

  if (selection.method === 'PASSKEY') {
    return mfa === null && passkeys.length > 0
  }

  return false
}

/**
 * Creates a password-authenticated session.
 * MFA remains unverified until explicitly completed.
 */
export async function createAdminSession(adminId: string) {
  const { token, tokenHash } = createSessionToken()

  const session = await db.orm.public.AdminSession.create({
    adminId,
    refreshTokenHash: tokenHash,
    expiresAt: getExpirationDate(),
    mfaVerifiedAt: null,
  })

  return {
    session,
    token,
  }
}

/**
 * Finds a valid session and checks that its admin account
 * is still active and its selected MFA method is configured.
 */
export async function getAdminSession(token: unknown) {
  if (!isValidSessionToken(token)) {
    return null
  }

  const tokenHash = hashSessionToken(token)

  const session = await db.orm.public.AdminSession.whereUnique({
    refreshTokenHash: tokenHash,
  }).first()

  if (!session || session.revokedAt !== null || isExpired(session.expiresAt)) {
    return null
  }

  const admin = await db.orm.public.AdminAccount.whereUnique({
    id: session.adminId,
  }).first()

  if (!admin || !admin.active || admin.disabledAt !== null) {
    return null
  }

  const mfaReady = await isSelectedMfaMethodReady(admin.id)

  return {
    session,
    admin,
    mfaVerified: session.mfaVerifiedAt !== null && mfaReady,
  }
}

/**
 * Marks a session as MFA-verified.
 * Only call this after successfully validating an MFA challenge.
 */
export async function verifyAdminSessionMfa(
  sessionId: string,
  adminId: string,
): Promise<boolean> {
  const session = await db.orm.public.AdminSession.whereUnique({
    id: sessionId,
  }).first()

  if (
    !session ||
    session.adminId !== adminId ||
    session.revokedAt !== null ||
    isExpired(session.expiresAt)
  ) {
    return false
  }

  const admin = await db.orm.public.AdminAccount.whereUnique({
    id: adminId,
  }).first()

  if (!admin || !admin.active || admin.disabledAt !== null) {
    return false
  }

  if (!(await isSelectedMfaMethodReady(adminId))) {
    return false
  }

  const now = new Date().toISOString()

  const updated = await db.orm.public.AdminSession.where({
    id: sessionId,
    adminId,
    revokedAt: null,
    expiresAt: session.expiresAt,
  }).update({
    mfaVerifiedAt: now,
    lastSeenAt: now,
  })

  return updated !== null
}

/**
 * Revokes a session by its raw cookie token.
 * The raw token is never stored in the database.
 */
export async function revokeAdminSession(token: unknown): Promise<boolean> {
  if (!isValidSessionToken(token)) {
    return false
  }

  const tokenHash = hashSessionToken(token)

  const updated = await db.orm.public.AdminSession.whereUnique({
    refreshTokenHash: tokenHash,
  }).update({
    revokedAt: new Date().toISOString(),
  })

  return updated !== null
}
