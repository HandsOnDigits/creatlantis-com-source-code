import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { Temporal } from 'temporal-polyfill'

import { mainQueryPool } from '../db/main-query.pool'

import { db } from '../../src/prisma/db'
import { requireAuth } from '../auth/auth.middleware'
import { ALLOWED_CONTENT_TYPES } from '../media/media.constants'
import {
  createOriginalUploadUrl,
  getPublicObjectUrl,
} from '../storage/b2.client'

const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const UPLOAD_LIFETIME_MS = 15 * 60 * 1000

const createAvatarUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  size: z.number().int().positive().max(MAX_AVATAR_SIZE),
})

const router = Router()

const userDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  sort: z.enum(['newest', 'oldest', 'alphabetical']).default('newest'),
  search: z.string().trim().min(1).max(50).optional(),
})

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

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

    username: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers and underscores',
      )
      .optional(),

    name: z.string().trim().min(1).max(100).optional(),

    nameIsPublic: z.boolean().optional(),

    birthDate: z
      .string()
      .refine(isValidDateOnly, 'Invalid date of birth')
      .nullable()
      .optional(),

    birthDateIsPublic: z.boolean().optional(),

    gender: z.string().trim().min(1).max(100).nullable().optional(),

    genderIsPublic: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  })

// Helpers

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'sqlState' in error &&
    error.sqlState === '23505'
  )
}

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
    .select(
      'id',
      'email',
      'username',
      'name',
      'nameIsPublic',
      'birthDate',
      'birthDateIsPublic',
      'gender',
      'genderIsPublic',
      'createdAt',
    )
    .all()

  res.json({ data: users })
})

// Browse public users
router.get('/directory', async (req, res) => {
  const parsed = userDirectoryQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid directory query',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const { page, limit, sort, search } = parsed.data
  const offset = (page - 1) * limit

  const orderBy =
    sort === 'alphabetical'
      ? '"username" ASC, "id" ASC'
      : sort === 'oldest'
        ? '"createdAt" ASC, "id" ASC'
        : '"createdAt" DESC, "id" DESC'

  const result = await mainQueryPool.query<{
    id: number
    username: string
    name: string | null
    nameIsPublic: boolean
    tagline: string | null
    createdAt: Date
  }>(
    `
      SELECT
        "id",
        "username",
        "name",
        "nameIsPublic",
        "tagline",
        "createdAt"
      FROM public."User"
      WHERE (
        $1::text IS NULL
        OR strpos(lower("username"), lower($1)) > 0
      )
      ORDER BY ${orderBy}
      LIMIT $2
      OFFSET $3
    `,
    [search ?? null, limit + 1, offset],
  )

  const users = result.rows

  const hasMore = users.length > limit
  const pageUsers = users.slice(0, limit)

  const data = await Promise.all(
    pageUsers.map(async (user) => {
      const avatar = await db.orm.public.UserAvatar.where({
        userId: user.id,
        status: 'APPROVED',
      })
        .select('publicObjectKey')
        .first()

      return {
        id: user.id,
        username: user.username,
        ...(user.nameIsPublic && user.name !== null ? { name: user.name } : {}),
        tagline: user.tagline,
        createdAt: user.createdAt.toISOString(),
        avatarUrl: avatar?.publicObjectKey
          ? getPublicObjectUrl(avatar.publicObjectKey)
          : null,
      }
    }),
  )

  res.json({
    data,
    pagination: {
      page,
      limit,
      hasMore,
    },
  })
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
    .select(
      'id',
      'email',
      'username',
      'name',
      'nameIsPublic',
      'birthDate',
      'birthDateIsPublic',
      'gender',
      'genderIsPublic',
      'createdAt',
    )
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

  let user

  try {
    const { birthDate, ...otherData } = parsed.data

    const updateData = {
      ...otherData,
      ...(birthDate !== undefined
        ? {
            birthDate:
              birthDate === null ? null : Temporal.PlainDate.from(birthDate),
          }
        : {}),
    }

    user = await db.orm.public.User.where({ id }).update(updateData)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({
        error: 'Email or username is already taken',
      })
      return
    }

    throw error
  }

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
      nameIsPublic: user.nameIsPublic,
      birthDate: user.birthDate,
      birthDateIsPublic: user.birthDateIsPublic,
      gender: user.gender,
      genderIsPublic: user.genderIsPublic,
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

router.post('/upload', requireAuth, async (req, res) => {
  const parsed = createAvatarUploadSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid avatar upload request.',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  const { filename, contentType, size } = parsed.data

  const uploadId = randomUUID()
  const objectKey = `avatars/${userId}/${uploadId}/source`
  const expiresAt = new Date(Date.now() + UPLOAD_LIFETIME_MS).toISOString()

  try {
    const uploadUrl = await createOriginalUploadUrl(
      objectKey,
      contentType,
      size,
    )

    res.setHeader('Cache-Control', 'no-store')

    return res.status(201).json({
      data: {
        id: uploadId,
        objectKey,
        uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        expiresAt,
        expiresIn: 300,
      },
    })
  } catch (error) {
    console.error('Failed to create avatar upload URL:', error)

    return res.status(500).json({
      error: 'Failed to prepare the avatar upload.',
    })
  }
})

export default router
