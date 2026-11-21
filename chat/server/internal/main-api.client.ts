import { z } from 'zod'

const recipientResponseSchema = z.object({
  recipient: z.object({
    identityId: z.string().uuid(),
    username: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
  }),
})

const recipientsResponseSchema = z.object({
  recipients: z.array(
    z.object({
      identityId: z.string().uuid(),
      username: z.string(),
      name: z.string().nullable(),
      avatarUrl: z.string().url().nullable(),
    }),
  ),
})

export type ChatRecipient = z.infer<typeof recipientResponseSchema>['recipient']

export async function resolveChatRecipient(
  identityId: string,
): Promise<ChatRecipient | null> {
  const secret = process.env.CHAT_INTERNAL_SECRET

  if (!secret) {
    throw new Error('CHAT_INTERNAL_SECRET is not configured')
  }

  const baseUrl = (process.env.MAIN_API_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  )

  const response = await fetch(
    `${baseUrl}/api/chat/internal/resolve-recipient`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identityId }),
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      `Main API recipient lookup failed with status ${response.status}`,
    )
  }

  const body: unknown = await response.json()
  const parsed = recipientResponseSchema.safeParse(body)

  if (!parsed.success) {
    throw new Error('Main API returned an invalid recipient response')
  }

  return parsed.data.recipient
}

export async function resolveChatRecipients(
  identityIds: string[],
): Promise<ChatRecipient[]> {
  if (identityIds.length === 0) {
    return []
  }

  const secret = process.env.CHAT_INTERNAL_SECRET

  if (!secret) {
    throw new Error('CHAT_INTERNAL_SECRET is not configured')
  }

  const baseUrl = (process.env.MAIN_API_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  )

  const response = await fetch(
    `${baseUrl}/api/chat/internal/resolve-recipients`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identityIds: [...new Set(identityIds)],
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Main API batch recipient lookup failed with status ${response.status}`,
    )
  }

  const body: unknown = await response.json()
  const parsed = recipientsResponseSchema.safeParse(body)

  if (!parsed.success) {
    throw new Error('Main API returned an invalid recipients response')
  }

  return parsed.data.recipients
}
