import { Router } from 'express'

import { db } from '../../src/prisma/db'

const router = Router()

function parseCatalogId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

// List all catalogs, including empty ones.
router.get('/', async (_req, res) => {
  const catalogs = await db.orm.public.Catalog.select(
    'id',
    'name',
    'slug',
    'description',
    'createdAt',
  )
    .orderBy((catalog) => catalog.name.asc())
    .all()

  return res.json({ data: catalogs })
})

// Get one catalog.
router.get('/:id', async (req, res) => {
  const id = parseCatalogId(req.params.id)

  if (id === null) {
    return res.status(400).json({ error: 'Invalid catalog ID' })
  }

  const catalog = await db.orm.public.Catalog.where({ id })
    .select('id', 'name', 'slug', 'description', 'createdAt')
    .first()

  if (!catalog) {
    return res.status(404).json({ error: 'Catalog not found' })
  }

  return res.json({ data: catalog })
})

export default router
