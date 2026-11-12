import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

import { publishLiveEvent } from './live.service'

const router = Router()

const moderationEventSchema = z.object({
  type: z.enum(['post.approved', 'post.rejected']),
  postId: z.number().int().positive(),
  authorId: z.number().int().positive(),
})

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

  const { type, postId, authorId } = parsed.data

  publishLiveEvent(type, { postId }, { userIds: [authorId] })

  if (type === 'post.approved') {
    publishLiveEvent('post.created', { postId }, { audience: 'all-users' })
  }

  return res.status(202).json({
    success: true,
  })
})

export default router
