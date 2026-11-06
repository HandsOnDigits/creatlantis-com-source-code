import { db } from '../../../src/prisma/db'

export interface AdminSessionInfo {
  id: string
  createdAt: string
  lastSeenAt: string | null
  expiresAt: string
  mfaVerified: boolean
  current: boolean
}

export async function listAdminSessions(
  adminId: string,
  currentSessionId: string,
): Promise<AdminSessionInfo[]> {
  const sessions = await db.orm.public.AdminSession.where({ adminId }).all()

  const now = Date.now()

  return sessions
    .filter((session) => {
      const expiresAt = Date.parse(session.expiresAt)

      return (
        session.revokedAt === null &&
        Number.isFinite(expiresAt) &&
        expiresAt > now
      )
    })
    .map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      mfaVerified: session.mfaVerifiedAt !== null,
      current: session.id === currentSessionId,
    }))
}

export async function revokeAdminSessionById(
  adminId: string,
  sessionId: string,
  currentSessionId: string,
): Promise<boolean> {
  if (sessionId === currentSessionId) {
    return false
  }

  const updated = await db.orm.public.AdminSession.where({
    id: sessionId,
    adminId,
    revokedAt: null,
  }).update({
    revokedAt: new Date().toISOString(),
  })

  return updated !== null
}

export async function revokeOtherAdminSessions(
  adminId: string,
  currentSessionId: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const sessions = await tx.orm.public.AdminSession.where({
      adminId,
      revokedAt: null,
    }).all()

    const otherSessions = sessions.filter(
      (session) => session.id !== currentSessionId,
    )

    const now = new Date().toISOString()

    for (const session of otherSessions) {
      await tx.orm.public.AdminSession.where({
        id: session.id,
        adminId,
        revokedAt: null,
      }).update({
        revokedAt: now,
      })
    }

    return otherSessions.length
  })
}
