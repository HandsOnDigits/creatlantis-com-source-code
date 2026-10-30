import { Router } from 'express'

import { db } from '../../src/prisma/db'

const router = Router()

function parseUserId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)

  return Number.isSafeInteger(id) ? id : null
}

// Get public profile
router.get('/:id', async (req, res) => {
  const id = parseUserId(req.params.id)

  if (id === null) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const user = await db.orm.public.User.where({ id })
    .select('id', 'username', 'name', 'nameIsPublic')
    .first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({
    data: {
      id: user.id,
      username: user.username,
      ...(user.nameIsPublic && user.name !== null ? { name: user.name } : {}),
    },
  })
})

export default router
