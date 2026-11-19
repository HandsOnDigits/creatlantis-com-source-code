import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

import { publishLiveEvent } from './live.service'

const router = Router()

const moderationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.enum(['post.approved', 'post.rejected']),
    postId: z.number().int().positive(),
    authorId: z.number().int().positive(),
  }),
  z.object({
    type: z.enum(['avatar.approved', 'avatar.rejected']),
    avatarId: z.string().uuid(),
    userId: z.number().int().positive(),
  }),
])

function isAuthorized(req: import('express').Request): boolean {
  const secret = process.env.LIVE_INTERNAL_SECRET
  const authorization = req.headers.authorization

  if (!secret || !authorization?.startsWith('Bearer ')) {
    return false
  }

  const provided = Buffer.from(authorization.slice(7))
  const expected = Buffer.from(secret)

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  )
}

router.post('/moderation', (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
    })
  }

  const parsed = moderationEventSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid moderation event',
    })
  }

  const event = parsed.data

  if (event.type === 'post.approved' || event.type === 'post.rejected') {
    publishLiveEvent(
      event.type,
      { postId: event.postId },
      {
        userIds: [event.authorId],
      },
    )

    if (event.type === 'post.approved') {
      publishLiveEvent(
        'post.created',
        { postId: event.postId },
        { audience: 'all-users' },
      )
    }
  } else if (
    event.type === 'avatar.approved' ||
    event.type === 'avatar.rejected'
  ) {
    publishLiveEvent(
      event.type,
      { avatarId: event.avatarId },
      { userIds: [event.userId] },
    )
  }

  return res.status(202).json({
    success: true,
  })
})

export default router
