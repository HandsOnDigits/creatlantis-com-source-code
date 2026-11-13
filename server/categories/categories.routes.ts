import { Router } from 'express'

import { db } from '../../src/prisma/db'

const router = Router()

function parseCategoryId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

// List all categories, including empty ones.
router.get('/', async (_req, res) => {
  const categories = await db.orm.public.Category.select(
    'id',
    'name',
    'slug',
    'description',
    'createdAt',
  )
    .orderBy((category) => category.name.asc())
    .all()

  return res.json({ data: categories })
})

// Get one category.
router.get('/:id', async (req, res) => {
  const id = parseCategoryId(req.params.id)

  if (id === null) {
    return res.status(400).json({ error: 'Invalid category ID' })
  }

  const category = await db.orm.public.Category.where({ id })
    .select('id', 'name', 'slug', 'description', 'createdAt')
    .first()

  if (!category) {
    return res.status(404).json({ error: 'Category not found' })
  }

  return res.json({ data: category })
})

export default router
