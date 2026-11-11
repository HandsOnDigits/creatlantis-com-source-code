import { db } from '../../src/prisma/db'

export interface RecordModerationActionInput {
  adminId: string
  action: 'CONTENT_APPROVED' | 'CONTENT_REJECTED'
  targetType: 'POST'
  targetId: string
  reason?: string | null
}

export async function recordModerationAction(
  input: RecordModerationActionInput,
): Promise<void> {
  const idempotencyKey = `${input.action}:${input.targetId}`

  const existing = await db.orm.public.ModerationAction.where({
    idempotencyKey,
  })
    .select('id', 'adminId', 'action', 'targetType', 'targetId')
    .first()

  if (existing) {
    if (
      existing.adminId !== input.adminId ||
      existing.action !== input.action ||
      existing.targetType !== input.targetType ||
      existing.targetId !== input.targetId
    ) {
      throw new Error(
        'An existing moderation action conflicts with this decision.',
      )
    }

    return
  }

  try {
    await db.orm.public.ModerationAction.create({
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      reportId: null,
      idempotencyKey,
    })
  } catch (error) {
    // A concurrent request may have inserted the same action.
    const concurrentAction = await db.orm.public.ModerationAction.where({
      idempotencyKey,
    })
      .select('id', 'adminId', 'action', 'targetType', 'targetId')
      .first()

    if (
      !concurrentAction ||
      concurrentAction.adminId !== input.adminId ||
      concurrentAction.action !== input.action ||
      concurrentAction.targetType !== input.targetType ||
      concurrentAction.targetId !== input.targetId
    ) {
      throw error
    }
  }
}
