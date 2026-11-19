import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'
import { PROFILE_WIDGET_TYPES } from '../../src/types/profile'
import { requireAuth } from '../auth/auth.middleware'
import { renderProfileBBCode } from './profile-renderer'

import { getPublicObjectUrl } from '../storage/b2.client'

const router = Router()

const MAX_DESCRIPTION_LENGTH = 20_000
const MAX_CSS_LENGTH = 50_000

// Validation
const updateCustomizationSchema = z
  .object({
    description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
    customCss: z.string().max(MAX_CSS_LENGTH).optional(),
  })
  .refine(
    (data) => data.description !== undefined || data.customCss !== undefined,
    {
      message: 'At least one field must be provided',
    },
  )

const updateTaglineSchema = z.object({
  tagline: z
    .string()
    .trim()
    .max(160)
    .transform((value) => (value === '' ? null : value))
    .nullable(),
})

const profileWidgetSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  type: z.enum(PROFILE_WIDGET_TYPES),
})

const profileColumnSchema = z.object({
  id: z.enum(['main', 'sidebar']),
  widgets: z.array(profileWidgetSchema).max(20),
})

const profileLayoutSchema = z
  .object({
    columns: z.array(profileColumnSchema).length(2),
  })
  .refine(
    (layout) =>
      layout.columns.some((column) => column.id === 'main') &&
      layout.columns.some((column) => column.id === 'sidebar'),
    { message: 'Layout must contain main and sidebar columns' },
  )
  .refine(
    (layout) => {
      const ids = layout.columns.flatMap((column) =>
        column.widgets.map((widget) => widget.id),
      )

      return new Set(ids).size === ids.length
    },
    { message: 'Widget IDs must be unique' },
  )

const updateProfileLayoutSchema = z.object({
  layout: profileLayoutSchema,
})

const DEFAULT_PROFILE_LAYOUT = {
  columns: [
    {
      id: 'main',
      widgets: [
        { id: 'header', type: 'header' },
        { id: 'bio', type: 'bio' },
        { id: 'gallery', type: 'gallery' },
      ],
    },
    {
      id: 'sidebar',
      widgets: [
        { id: 'statistics', type: 'statistics' },
        { id: 'journal', type: 'journal' },
      ],
    },
  ],
}

function normalizeProfileLayout(value: unknown) {
  const parsed = profileLayoutSchema.safeParse(value)

  if (parsed.success) {
    return parsed.data
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    !('columns' in value) ||
    !Array.isArray(value.columns)
  ) {
    return DEFAULT_PROFILE_LAYOUT
  }

  const normalized = {
    columns: value.columns
      .map((column) => {
        if (
          typeof column !== 'object' ||
          column === null ||
          !('id' in column) ||
          !('widgets' in column) ||
          !Array.isArray(column.widgets)
        ) {
          return null
        }

        return {
          id: column.id,
          widgets: column.widgets.flatMap((widget: unknown) => {
            if (
              typeof widget !== 'object' ||
              widget === null ||
              !('id' in widget) ||
              !('type' in widget) ||
              typeof widget.id !== 'string' ||
              typeof widget.type !== 'string'
            ) {
              return []
            }

            const type = widget.type === 'about' ? 'bio' : widget.type

            if (
              !PROFILE_WIDGET_TYPES.includes(
                type as (typeof PROFILE_WIDGET_TYPES)[number],
              )
            ) {
              return []
            }

            return [{ id: widget.id, type }]
          }),
        }
      })
      .filter((column) => column !== null),
  }

  const result = profileLayoutSchema.safeParse(normalized)
  return result.success ? result.data : DEFAULT_PROFILE_LAYOUT
}

function parseUserId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)

  return Number.isSafeInteger(id) ? id : null
}

// Get all public user information by username
router.get('/username/:username', async (req, res) => {
  const username = req.params.username

  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: 'Invalid username' })
    return
  }

  const user = await db.orm.public.User.where({ username })
    .select('id', 'username', 'name', 'nameIsPublic', 'createdAt', 'tagline')
    .first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Load public profile information in parallel
  const [customization, savedLayout, avatar] = await Promise.all([
    db.orm.public.ProfileCustomization.where({
      userId: user.id,
    })
      .select('description')
      .first(),

    db.orm.public.ProfileLayout.where({
      userId: user.id,
    }).first(),

    db.orm.public.UserAvatar.where({
      userId: user.id,
    })
      .select('publicObjectKey', 'status')
      .first(),
  ])

  res.json({
    data: {
      id: user.id,
      username: user.username,
      name: user.nameIsPublic && user.name !== null ? user.name : null,
      createdAt: user.createdAt,
      tagline: user.tagline,
      avatarUrl: avatar?.publicObjectKey
        ? getPublicObjectUrl(avatar.publicObjectKey)
        : null,

      customization: {
        descriptionHtml: renderProfileBBCode(customization?.description ?? ''),
      },

      layout: {
        version: savedLayout?.version ?? 1,
        layout: normalizeProfileLayout(
          savedLayout?.layout ?? DEFAULT_PROFILE_LAYOUT,
        ),
      },
    },
  })
})

// Update own public profile tagline
router.put('/me/tagline', requireAuth, async (req, res) => {
  const parsed = updateTaglineSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid tagline',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const userId = req.auth!.userId

  const user = await db.orm.public.User.where({ id: userId }).update({
    tagline: parsed.data.tagline,
  })

  if (!user) {
    res.status(404).json({
      error: 'User not found',
    })
    return
  }

  res.json({
    data: {
      tagline: user.tagline,
    },
  })
})

// Get public profile customization by username
router.get('/username/:username/customization', async (req, res) => {
  const username = req.params.username

  const user = await db.orm.public.User.where({ username }).select('id').first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const customization = await db.orm.public.ProfileCustomization.where({
    userId: user.id,
  })
    .select('description')
    .first()

  res.json({
    data: {
      descriptionHtml: renderProfileBBCode(customization?.description ?? ''),
    },
  })
})

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

// Get own profile layout
router.get('/me/layout', requireAuth, async (req, res) => {
  const userId = req.auth!.userId

  const savedLayout = await db.orm.public.ProfileLayout.where({
    userId,
  }).first()

  res.json({
    data: {
      version: savedLayout?.version ?? 1,
      layout: savedLayout?.layout ?? DEFAULT_PROFILE_LAYOUT,
    },
  })
})

// Update own profile layout
router.put('/me/layout', requireAuth, async (req, res) => {
  const parsed = updateProfileLayoutSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid profile layout',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const userId = req.auth!.userId

  const existing = await db.orm.public.ProfileLayout.where({
    userId,
  }).first()

  const savedLayout = existing
    ? await db.orm.public.ProfileLayout.where({ userId }).update({
        layout: parsed.data.layout,
        version: 1,
      })
    : await db.orm.public.ProfileLayout.create({
        userId,
        layout: parsed.data.layout,
        version: 1,
      })

  if (!savedLayout) {
    res.status(500).json({
      error: 'Failed to save profile layout',
    })
    return
  }

  res.json({
    data: {
      version: savedLayout.version,
      layout: savedLayout.layout,
    },
  })
})

// Get public profile layout by username
router.get('/username/:username/layout', async (req, res) => {
  const username = req.params.username

  const user = await db.orm.public.User.where({ username }).select('id').first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const savedLayout = await db.orm.public.ProfileLayout.where({
    userId: user.id,
  }).first()

  res.json({
    data: {
      version: savedLayout?.version ?? 1,
      layout: savedLayout?.layout ?? DEFAULT_PROFILE_LAYOUT,
    },
  })
})

// Get own profile customization (editor)
router.get('/me/customization', requireAuth, async (req, res) => {
  const userId = req.auth!.userId

  const customization = await db.orm.public.ProfileCustomization.where({
    userId,
  }).first()

  res.json({
    data: customization ?? {
      description: '',
      customCss: '',
    },
  })
})

// Get public profile customization
router.get('/:id/customization', async (req, res) => {
  const id = parseUserId(req.params.id)

  if (id === null) {
    res.status(400).json({ error: 'Invalid user ID' })
    return
  }

  const user = await db.orm.public.User.where({ id }).select('id').first()

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const customization = await db.orm.public.ProfileCustomization.where({
    userId: id,
  })
    .select('description')
    .first()

  const description = customization?.description ?? ''

  res.json({
    data: {
      descriptionHtml: renderProfileBBCode(description),
    },
  })
})

// Update own profile customization
router.put('/me/customization', requireAuth, async (req, res) => {
  const parsed = updateCustomizationSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid profile customization',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const userId = req.auth!.userId

  const existing = await db.orm.public.ProfileCustomization.where({
    userId,
  }).first()

  const customization = existing
    ? await db.orm.public.ProfileCustomization.where({ userId }).update(
        parsed.data,
      )
    : await db.orm.public.ProfileCustomization.create({
        userId,
        description: parsed.data.description ?? '',
        customCss: parsed.data.customCss ?? '',
      })

  if (!customization) {
    res.status(404).json({
      error: 'Profile customization not found',
    })
    return
  }

  res.json({
    data: customization,
  })
})

export default router
