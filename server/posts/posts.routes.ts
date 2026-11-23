import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'
import { mainQueryPool } from '../db/main-query.pool'
import { getMediaVariantUrl, getPublicObjectUrl } from '../storage/b2.client'
import { requireAuth } from '../auth/auth.middleware'
import { publishLiveEvent } from '../live/live.service'

const router = Router()

const postListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'oldest', 'alphabetical']).default('newest'),
  search: z.string().trim().min(1).max(100).optional(),
})

function parseCategoryId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

function parsePostId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null
  }

  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

router.get('/', async (req, res) => {
  const parsed = postListQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid post list query',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const { page, limit, sort, search } = parsed.data
  const pageSize = limit
  const offset = (page - 1) * pageSize

  const categoryId =
    req.query.categoryId === undefined
      ? null
      : parseCategoryId(req.query.categoryId)

  if (req.query.categoryId !== undefined && categoryId === null) {
    return res.status(400).json({
      error: 'Invalid category ID',
    })
  }

  if (categoryId !== null) {
    const category = await db.orm.public.Category.where({ id: categoryId })
      .select('id')
      .first()

    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
      })
    }
  }

  const orderBy =
    sort === 'alphabetical'
      ? 'p."title" ASC, p."id" ASC'
      : sort === 'oldest'
        ? 'p."createdAt" ASC, p."id" ASC'
        : 'p."createdAt" DESC, p."id" DESC'

  const result = await mainQueryPool.query<{ id: number }>(
    `
      SELECT p."id"
      FROM public."Post" p
      WHERE
        p."publicationStatus" = 'APPROVED'
        AND (
          $1::integer IS NULL
          OR EXISTS (
            SELECT 1
            FROM public."CategoryPost" cp
            WHERE cp."postId" = p."id"
              AND cp."categoryId" = $1
          )
        )
        AND (
          $2::text IS NULL
          OR strpos(lower(p."title"), lower($2)) > 0
          OR strpos(lower(COALESCE(p."content", '')), lower($2)) > 0
        )
        ORDER BY ${orderBy}
      LIMIT $3
      OFFSET $4
    `,
    [categoryId, search ?? null, pageSize + 1, offset],
  )

  const hasMore = result.rows.length > pageSize

  const pagePosts = (
    await Promise.all(
      result.rows.slice(0, pageSize).map((row) =>
        db.orm.public.Post.where({
          id: row.id,
          publicationStatus: 'APPROVED',
        })
          .select('id', 'type', 'title', 'content', 'createdAt', 'authorId')
          .first(),
      ),
    )
  ).filter((post) => post !== null)

  const data = await Promise.all(
    pagePosts.map(async (post) => {
      const author = await db.orm.public.User.where({ id: post.authorId })
        .select('id', 'username', 'name', 'nameIsPublic')
        .first()

      const avatar = author
        ? await db.orm.public.UserAvatar.where({
            userId: author.id,
            status: 'APPROVED',
          })
            .select('publicObjectKey')
            .first()
        : null

      const postMedia = await db.orm.public.PostMedia.where({ postId: post.id })
        .orderBy((item) => item.position.asc())
        .all()

      const images = await Promise.all(
        postMedia.map(async (item) => {
          const media = await db.orm.public.Media.where({
            id: item.mediaId,
            status: 'READY',
          })
            .select('id', 'width', 'height')
            .first()

          if (!media) return null

          const variants = await db.orm.public.MediaVariant.where({
            mediaId: media.id,
          })
            .orderBy((variant) => variant.width.asc())
            .select('width', 'height', 'format', 'publicObjectKey')
            .all()

          return {
            id: media.id,
            width: media.width,
            height: media.height,
            variants: variants
              .filter((variant) => variant.publicObjectKey !== null)
              .map((variant) => ({
                width: variant.width,
                height: variant.height,
                format: variant.format,
                url: getMediaVariantUrl(variant.publicObjectKey!),
              })),
          }
        }),
      )

      return {
        ...post,
        author: author
          ? {
              id: author.id,
              username: author.username,
              name: author.nameIsPublic ? author.name : null,
              avatarUrl: avatar?.publicObjectKey
                ? getPublicObjectUrl(avatar.publicObjectKey)
                : null,
            }
          : null,
        images: images.filter((image) => image !== null),
      }
    }),
  )

  return res.json({
    data,
    pagination: {
      page,
      limit: pageSize,
      hasMore,
    },
  })
})

const createPostSchema = z
  .object({
    type: z.enum(['IMAGE', 'JOURNAL', 'MODEL']).default('IMAGE'),
    title: z.string().trim().min(1).max(200),
    content: z.string().max(50000).nullable().optional(),
    mediaIds: z.array(z.string().uuid()).max(20).default([]),
    categoryIds: z.array(z.number().int().positive()).max(50).default([]),
  })
  .refine((data) => data.type !== 'MODEL', {
    message: 'Model posts are not available yet',
    path: ['type'],
  })
  .refine((data) => data.type !== 'IMAGE' || data.mediaIds.length > 0, {
    message: 'Image posts require at least one image',
    path: ['mediaIds'],
  })
  .refine((data) => data.type !== 'JOURNAL' || data.mediaIds.length === 0, {
    message: 'Journal posts cannot contain media',
    path: ['mediaIds'],
  })
  .refine((data) => data.type !== 'JOURNAL' || Boolean(data.content?.trim()), {
    message: 'Journal posts require content',
    path: ['content'],
  })
  .refine((data) => new Set(data.mediaIds).size === data.mediaIds.length, {
    message: 'Duplicate media IDs are not allowed',
    path: ['mediaIds'],
  })

router.post('/', requireAuth, async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid post data',
      details: parsed.error.flatten(),
    })
  }

  const { type, title, content, mediaIds, categoryIds } = parsed.data
  const userId = req.auth!.userId

  const post = await db.transaction(async (tx) => {
    // Validate that every media file belongs to the user and is READY.
    for (const mediaId of mediaIds) {
      const media = await tx.orm.public.Media.where({
        id: mediaId,
        userId,
        status: 'READY',
      })
        .select('id')
        .first()

      if (!media) {
        return null
      }
    }

    // Validate that every category exists.
    for (const categoryId of categoryIds) {
      const category = await tx.orm.public.Category.where({ id: categoryId })
        .select('id')
        .first()

      if (!category) {
        return null
      }
    }

    // Create the post.
    const createdPost = await tx.orm.public.Post.create({
      type,
      title,
      content: content ?? null,
      authorId: userId,
      publicationStatus: 'PENDING_APPROVAL',
    })

    // Attach categories in the supplied order.
    for (const [position, categoryId] of categoryIds.entries()) {
      await tx.orm.public.CategoryPost.create({
        postId: createdPost.id,
        categoryId,
        position,
      })
    }

    // Attach media in the supplied order.
    for (const [position, mediaId] of mediaIds.entries()) {
      await tx.orm.public.PostMedia.create({
        postId: createdPost.id,
        mediaId,
        position,
      })
    }

    return createdPost
  })

  if (!post) {
    return res.status(400).json({
      error: 'One or more media files or categories are unavailable.',
    })
  }

  publishLiveEvent(
    'post.created',
    {
      postId: post.id,
      publicationStatus: post.publicationStatus,
    },
    { userIds: [userId] },
  )

  return res.status(201).json({
    data: post,
  })
})

// Get post with its processed images
router.get('/:id', async (req, res) => {
  const id = parsePostId(req.params.id)

  if (id === null) {
    return res.status(400).json({ error: 'Invalid post ID' })
  }

  const post = await db.orm.public.Post.where({
    id,
    publicationStatus: 'APPROVED',
  })
    .select('id', 'type', 'title', 'content', 'createdAt', 'authorId')
    .first()

  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  const author = await db.orm.public.User.where({ id: post.authorId })
    .select('id', 'username', 'name', 'nameIsPublic')
    .first()

  const avatar = author
    ? await db.orm.public.UserAvatar.where({
        userId: author.id,
        status: 'APPROVED',
      })
        .select('publicObjectKey')
        .first()
    : null

  const postMedia = await db.orm.public.PostMedia.where({ postId: id })
    .orderBy((media) => media.position.asc())
    .all()

  const images = await Promise.all(
    postMedia.map(async (item) => {
      const media = await db.orm.public.Media.where({
        id: item.mediaId,
        status: 'READY',
      })
        .select('id', 'width', 'height')
        .first()

      if (!media) return null

      const variants = await db.orm.public.MediaVariant.where({
        mediaId: media.id,
      })
        .orderBy((variant) => variant.width.asc())
        .select('width', 'height', 'format', 'publicObjectKey')
        .all()

      return {
        id: media.id,
        width: media.width,
        height: media.height,
        variants: variants
          .filter((variant) => variant.publicObjectKey !== null)
          .map((variant) => ({
            width: variant.width,
            height: variant.height,
            format: variant.format,
            url: getMediaVariantUrl(variant.publicObjectKey!),
          })),
      }
    }),
  )

  return res.json({
    data: {
      ...post,
      author: author
        ? {
            id: author.id,
            username: author.username,
            name: author.nameIsPublic ? author.name : null,
            avatarUrl: avatar?.publicObjectKey
              ? getPublicObjectUrl(avatar.publicObjectKey)
              : null,
          }
        : null,
      images: images.filter((image) => image !== null),
    },
  })
})

// Get a user's approved image posts for their profile gallery
router.get('/user/:username', async (req, res) => {
  const username = req.params.username

  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({
      error: 'Invalid username',
    })
  }

  const user = await db.orm.public.User.where({ username })
    .select('id', 'username', 'name', 'nameIsPublic')
    .first()

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
    })
  }

  const page = z.coerce
    .number()
    .int()
    .min(1)
    .safeParse(req.query.page ?? 1)

  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .safeParse(req.query.limit ?? 12)

  if (!page.success || !limit.success) {
    return res.status(400).json({
      error: 'Invalid pagination parameters',
    })
  }

  const postType = z
    .enum(['IMAGE', 'JOURNAL'])
    .optional()
    .safeParse(req.query.type)

  if (!postType.success) {
    return res.status(400).json({
      error: 'Invalid post type',
    })
  }

  const pageSize = limit.data
  const offset = (page.data - 1) * pageSize

  const posts = await db.orm.public.Post.where({
    authorId: user.id,
    publicationStatus: 'APPROVED',
    ...(postType.data ? { type: postType.data } : {}),
  })
    .select('id', 'type', 'title', 'content', 'createdAt', 'authorId')
    .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()])
    .limit(pageSize + 1)
    .offset(offset)
    .all()

  const hasMore = posts.length > pageSize
  const pagePosts = posts.slice(0, pageSize)

  const data = await Promise.all(
    pagePosts.map(async (post) => {
      const postMedia = await db.orm.public.PostMedia.where({
        postId: post.id,
      })
        .orderBy((item) => item.position.asc())
        .all()

      const images = await Promise.all(
        postMedia.map(async (item) => {
          const media = await db.orm.public.Media.where({
            id: item.mediaId,
            status: 'READY',
          })
            .select('id', 'width', 'height')
            .first()

          if (!media) return null

          const variants = await db.orm.public.MediaVariant.where({
            mediaId: media.id,
          })
            .orderBy((variant) => variant.width.asc())
            .select('width', 'height', 'format', 'publicObjectKey')
            .all()

          return {
            id: media.id,
            width: media.width,
            height: media.height,
            variants: variants
              .filter((variant) => variant.publicObjectKey !== null)
              .map((variant) => ({
                width: variant.width,
                height: variant.height,
                format: variant.format,
                url: getMediaVariantUrl(variant.publicObjectKey!),
              })),
          }
        }),
      )

      return {
        ...post,
        author: {
          id: user.id,
          username: user.username,
          name: user.nameIsPublic ? user.name : null,
        },
        images: images.filter((image) => image !== null),
      }
    }),
  )

  return res.json({
    data,
    pagination: {
      page: page.data,
      limit: pageSize,
      hasMore,
    },
  })
})

export default router
