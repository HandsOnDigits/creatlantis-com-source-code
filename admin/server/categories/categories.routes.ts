import { Router } from 'express'
import { z } from 'zod'

import { mainDb } from '../../src/prisma/main-db'
import { requireMfaVerifiedAdmin } from '../middleware/auth.middleware'
import { requireModerator } from '../middleware/require-moderator'
import { recordAdminAuditEvent } from '../audit/audit.service'

const router = Router()

router.use(requireMfaVerifiedAdmin, requireModerator)

// Validation

const categoryFields = {
  name: z.string().trim().min(1).max(100).optional(),

  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(
      /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/,
      'Slug can only contain letters, numbers and single hyphens',
    )
    .transform((value) => value.toLowerCase())
    .optional(),

  description: z.string().trim().max(1000).nullable().optional(),
}

const createCategorySchema = z.object({
  name: categoryFields.name.unwrap(),
  slug: categoryFields.slug.unwrap(),
  description: categoryFields.description,
})

const updateCategorySchema = z
  .object(categoryFields)
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  })

// Helpers

function parseCategoryId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'sqlState' in error &&
    error.sqlState === '23505'
  )
}

// List categories

router.get('/', async (_req, res) => {
  const categories = await mainDb.orm.public.Category.select(
    'id',
    'name',
    'slug',
    'description',
    'createdAt',
    'updatedAt',
  )
    .orderBy((category) => category.name.asc())
    .all()

  return res.json({ data: categories })
})

// Create category

router.post('/', async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid category data',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  let category

  try {
    category = await mainDb.orm.public.Category.create({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        error: 'A category with this slug already exists.',
      })
    }

    throw error
  }

  await recordAdminAuditEvent({
    adminId: req.adminAuth!.adminId,
    event: 'CATEGORY_CREATED',
    targetType: 'CATEGORY',
    targetId: String(category.id),
  })

  return res.status(201).json({ data: category })
})

// Update category

router.patch('/:id', async (req, res) => {
  const id = parseCategoryId(req.params.id)

  if (id === null) {
    return res.status(400).json({ error: 'Invalid category ID' })
  }

  const parsed = updateCategorySchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid category data',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  let category

  try {
    category = await mainDb.orm.public.Category.where({ id }).update(
      parsed.data,
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        error: 'A category with this slug already exists.',
      })
    }

    throw error
  }

  if (!category) {
    return res.status(404).json({ error: 'Category not found' })
  }

  await recordAdminAuditEvent({
    adminId: req.adminAuth!.adminId,
    event: 'CATEGORY_UPDATED',
    targetType: 'CATEGORY',
    targetId: String(category.id),
  })

  return res.json({ data: category })
})

// Delete category

router.delete('/:id', async (req, res) => {
  const id = parseCategoryId(req.params.id)

  if (id === null) {
    return res.status(400).json({ error: 'Invalid category ID' })
  }

  const category = await mainDb.orm.public.Category.where({ id }).delete()

  if (!category) {
    return res.status(404).json({ error: 'Category not found' })
  }

  await recordAdminAuditEvent({
    adminId: req.adminAuth!.adminId,
    event: 'CATEGORY_DELETED',
    targetType: 'CATEGORY',
    targetId: String(id),
  })

  return res.status(204).send()
})

export default router
