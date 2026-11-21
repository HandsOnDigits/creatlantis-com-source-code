import { z } from 'zod'

const recipientResponseSchema = z.object({
  recipient: z.object({
    identityId: z.string().uuid(),
    username: z.string(),
    name: z.string().nullable(),
  }),
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
