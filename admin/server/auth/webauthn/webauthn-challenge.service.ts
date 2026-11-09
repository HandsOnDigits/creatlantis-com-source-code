import { db } from '../../../src/prisma/db'

type WebAuthnChallengeType = 'REGISTRATION' | 'AUTHENTICATION'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export async function storeWebAuthnChallenge(
  adminId: string,
  sessionId: string,
  challenge: string,
  type: WebAuthnChallengeType,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
    return false
  }

  return db.transaction(async (tx) => {
    const now = Date.now()

    const session = await tx.orm.public.AdminSession.whereUnique({
      id: sessionId,
    }).first()

    if (
      !session ||
      session.adminId !== adminId ||
      session.revokedAt !== null ||
      !Number.isFinite(Date.parse(session.expiresAt)) ||
      Date.parse(session.expiresAt) <= now
    ) {
      return false
    }

    const [admin, selection, mfa, passkeys] = await Promise.all([
      tx.orm.public.AdminAccount.whereUnique({
        id: adminId,
      }).first(),

      tx.orm.public.AdminMfaMethodSelection.whereUnique({
        adminId,
      }).first(),

      tx.orm.public.AdminMfa.whereUnique({
        adminId,
      }).first(),

      tx.orm.public.AdminPasskey.where({
        adminId,
      }).all(),
    ])

    if (!admin || !admin.active || admin.disabledAt !== null) {
      return false
    }

    if (selection?.method !== 'PASSKEY' || mfa !== null) {
      return false
    }

    if (type === 'AUTHENTICATION' && passkeys.length === 0) {
      return false
    }

    if (
      type === 'REGISTRATION' &&
      passkeys.length > 0 &&
      session.mfaVerifiedAt === null
    ) {
      return false
    }

    const updated = await tx.orm.public.AdminSession.where({
      id: sessionId,
      adminId,
      revokedAt: null,
      expiresAt: session.expiresAt,
      webauthnChallenge: session.webauthnChallenge,
      webauthnChallengeType: session.webauthnChallengeType,
      webauthnChallengeExpiresAt: session.webauthnChallengeExpiresAt,
    }).update({
      webauthnChallenge: challenge,
      webauthnChallengeType: type,
      webauthnChallengeExpiresAt: new Date(
        now + CHALLENGE_TTL_MS,
      ).toISOString(),
    })

    return updated !== null
  })
}
