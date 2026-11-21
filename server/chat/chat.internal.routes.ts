import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'

const router = Router()

const recipientSchema = z.object({
  identityId: z.string().uuid(),
})

function isAuthorized(req: import('express').Request): boolean {
  const secret = process.env.CHAT_INTERNAL_SECRET
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

router.post('/resolve-recipient', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const parsed = recipientSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid recipient identity' })
  }

  try {
    const user = await db.orm.public.User.where({
      identityId: parsed.data.identityId,
    })
      .select('identityId', 'username', 'name', 'nameIsPublic')
      .first()

    if (!user) {
      return res.status(404).json({ error: 'Recipient not found' })
    }

    return res.json({
      recipient: {
        identityId: user.identityId,
        username: user.username,
        name: user.nameIsPublic ? user.name : null,
      },
    })
  } catch (error) {
    console.error('Failed to resolve Chat recipient:', error)
    return res.status(500).json({ error: 'Failed to resolve recipient' })
  }
})

export default router
