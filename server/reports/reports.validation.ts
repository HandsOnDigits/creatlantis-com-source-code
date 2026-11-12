import { z } from 'zod'

export const createReportSchema = z
  .object({
    targetType: z.enum(['USER', 'POST', 'MEDIA']),
    targetId: z.string().trim().min(1).max(100),
    reason: z.enum([
      'SPAM',
      'HARASSMENT',
      'HATE_SPEECH',
      'INAPPROPRIATE_CONTENT',
      'VIOLENCE',
      'IMPERSONATION',
      'COPYRIGHT',
      'OTHER',
    ]),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const isValidId =
      value.targetType === 'MEDIA'
        ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value.targetId,
          )
        : /^[1-9]\d*$/.test(value.targetId) &&
          Number.isSafeInteger(Number(value.targetId))

    if (!isValidId) {
      context.addIssue({
        code: 'custom',
        path: ['targetId'],
        message: 'Invalid target ID',
      })
    }
  })
  .transform((value) => ({
    ...value,
    description: value.description?.trim() || null,
  }))