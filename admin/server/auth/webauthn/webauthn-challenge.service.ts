import { db } from '../../../src/prisma/db'

type WebAuthnChallengeType = 'REGISTRATION' | 'AUTHENTICATION'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export async function storeWebAuthnChallenge(
  adminId: string,
  sessionId: string,
  challenge: string,
  type: WebAuthnChallengeType,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = Date.now()

    const session = await tx.orm.public.AdminSession.whereUnique({
      id: sessionId,
    }).first()

    if (
      !session ||
      session.adminId !== adminId ||
      session.revokedAt !== null ||
      Date.parse(session.expiresAt) <= now
    ) {
      return false
    }

    const admin = await tx.orm.public.AdminAccount.whereUnique({
      id: adminId,
    }).first()

    if (!admin || !admin.active || admin.disabledAt !== null) {
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
