import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'
import { requireAuth } from '../auth/auth.middleware'

const router = Router()

// Validation
const updateUserSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .optional(),
    username: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  })

// Helpers
function parseUserId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)

  return Number.isSafeInteger(id) ? id : null
}

// List users (only the authenticated user's own record)
router.get('/', requireAuth, async (req, res) => {
  const users = await db.orm.public.User.where({ id: req.auth!.userId })
    .select('id', 'username', 'name', 'createdAt')
    .all()

  res.json({ data: users })
})

// Get user
router.get('/:id', requireAuth, async (req, res) => {
  const id = parseUserId(req.params.id)

  if (id === null) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  if (id !== req.auth!.userId) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const user = await db.orm.public.User.where({ id })
    .select('id', 'email', 'username', 'name', 'createdAt')
    .first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({ data: user })
})

// Update user
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseUserId(req.params.id)

  if (id === null) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  if (id !== req.auth!.userId) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const parsed = updateUserSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid user data',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const user = await db.orm.public.User.where({ id }).update(parsed.data)

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      createdAt: user.createdAt,
    },
  })
})

// Delete user
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseUserId(req.params.id)

  if (id === null) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  if (id !== req.auth!.userId) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const user = await db.orm.public.User.where({ id }).delete()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.status(204).send()
})

export default router
