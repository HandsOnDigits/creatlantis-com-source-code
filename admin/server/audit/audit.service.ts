import { db } from '../../src/prisma/db'

export interface AdminAuditEvent {
  adminId?: string | null
  event: string
  targetType?: string | null
  targetId?: string | null
  requestId?: string | null
}

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
