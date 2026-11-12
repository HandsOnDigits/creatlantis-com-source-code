import type { Response } from 'express'
import { randomUUID } from 'node:crypto'

export type LiveEventType =
  | 'post.created'
  | 'post.updated'
  | 'post.deleted'
  | 'post.approved'
  | 'post.rejected'
  | 'report.created'
  | 'report.updated'
  | 'comment.created'
  | 'comment.deleted'
  | 'notification.created'
  | 'profile.updated'
  | 'media.updated'
  | 'catalog.updated'

export interface LiveEvent<T = unknown> {
  id: string
  type: LiveEventType
  data: T
  createdAt: string
}

interface LiveClient {
  id: string
  userId: number
  response: Response
}

const clients = new Map<string, LiveClient>()

export function addLiveClient(userId: number, response: Response): string {
  const id = randomUUID()

  clients.set(id, {
    id,
    userId,
    response,
  })

  return id
}

export function removeLiveClient(id: string): void {
  clients.delete(id)
}

export function publishLiveEvent<T>(
  type: LiveEventType,
  data: T,
  options: { audience: 'all-users' } | { userIds: readonly number[] },
): void {
  const event: LiveEvent<T> = {
    id: randomUUID(),
    type,
    data,
    createdAt: new Date().toISOString(),
  }

  const payload =
    `id: ${event.id}\n` +
    `event: ${event.type}\n` +
    `data: ${JSON.stringify(event)}\n\n`

  for (const client of clients.values()) {
    const shouldReceive =
      'audience' in options
        ? options.audience === 'all-users'
        : options.userIds.includes(client.userId)

    if (shouldReceive && !client.response.writableEnded) {
      client.response.write(payload)
    }
  }
}

export function getLiveClientCount(): number {
  return clients.size
}
