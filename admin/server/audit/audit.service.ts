import { db } from '../../src/prisma/db'

export interface AdminAuditEvent {
  adminId?: string | null
  event: string
  targetType?: string | null
  targetId?: string | null
  requestId?: string | null
}

type AuditTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recordAdminAuditEvent(
  input: AdminAuditEvent,
): Promise<void> {
  await db.orm.public.AdminAuditLog.create({
    adminId: input.adminId ?? null,
    event: input.event,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    requestId: input.requestId ?? null,
  })
}

export async function recordAdminAuditEventInTransaction(
  tx: AuditTransaction,
  input: AdminAuditEvent,
): Promise<void> {
  await tx.orm.public.AdminAuditLog.create({
    adminId: input.adminId ?? null,
    event: input.event,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    requestId: input.requestId ?? null,
  })
}
