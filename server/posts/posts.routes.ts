import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'
import { getMediaVariantUrl } from '../storage/b2.client'
import { requireAuth } from '../auth/auth.middleware'

const router = Router()

function parseCatalogId(value: unknown): number | null {
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
    .safeParse(req.query.limit ?? 10)

  if (!page.success || !limit.success) {
    return res.status(400).json({
      error: 'Invalid pagination parameters',
    })
  }

  const pageSize = limit.data
  const offset = (page.data - 1) * pageSize

  const catalogId =
    req.query.catalogId === undefined
      ? null
      : parseCatalogId(req.query.catalogId)

  if (req.query.catalogId !== undefined && catalogId === null) {
    return res.status(400).json({
      error: 'Invalid catalog ID',
    })
  }

  let pagePosts
  let hasMore: boolean

  if (catalogId !== null) {
    const catalog = await db.orm.public.Catalog.where({ id: catalogId })
      .select('id')
      .first()

    if (!catalog) {
      return res.status(404).json({
        error: 'Catalog not found',
      })
    }

    const catalogPosts = await db.orm.public.CatalogPost.where({
      catalogId,
    })
      .orderBy([(item) => item.position.asc(), (item) => item.postId.asc()])
      .limit(pageSize + 1)
      .offset(offset)
      .all()

    hasMore = catalogPosts.length > pageSize

    const pageCatalogPosts = catalogPosts.slice(0, pageSize)

    const loadedPosts = await Promise.all(
      pageCatalogPosts.map((item) =>
        db.orm.public.Post.where({ id: item.postId })
          .select('id', 'type', 'title', 'content', 'createdAt', 'authorId')
          .first(),
      ),
    )

    pagePosts = loadedPosts.filter((post) => post !== null)
  } else {
    const posts = await db.orm.public.Post.select(
      'id',
      'type',
      'title',
      'content',
      'createdAt',
      'authorId',
    )
      .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()])
      .limit(pageSize + 1)
      .offset(offset)
      .all()

    hasMore = posts.length > pageSize
    pagePosts = posts.slice(0, pageSize)
  }

  const data = await Promise.all(
    pagePosts.map(async (post) => {
      const author = await db.orm.public.User.where({ id: post.authorId })
        .select('id', 'username', 'name', 'nameIsPublic')
        .first()

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
            .select('width', 'height', 'format', 'objectKey')
            .all()

          return {
            id: media.id,
            width: media.width,
            height: media.height,
            variants: variants.map((variant) => ({
              width: variant.width,
              height: variant.height,
              format: variant.format,
              url: getMediaVariantUrl(variant.objectKey),
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
            }
          : null,
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

const createPostSchema = z
  .object({
    type: z.enum(['IMAGE', 'JOURNAL', 'MODEL']).default('IMAGE'),
    title: z.string().trim().min(1).max(200),
    content: z.string().max(50000).nullable().optional(),
    mediaIds: z.array(z.string().uuid()).max(20).default([]),
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

  const { type, title, content, mediaIds } = parsed.data
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

    // Create the post.
    const createdPost = await tx.orm.public.Post.create({
      type,
      title,
      content: content ?? null,
      authorId: userId,
    })

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
      error: 'One or more media files are unavailable or not ready.',
    })
  }

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

  const post = await db.orm.public.Post.where({ id })
    .select('id', 'type', 'title', 'content', 'createdAt', 'authorId')
    .first()

  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  const author = await db.orm.public.User.where({ id: post.authorId })
    .select('id', 'username', 'name', 'nameIsPublic')
    .first()

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
        .select('width', 'height', 'format', 'objectKey')
        .all()

      return {
        id: media.id,
        width: media.width,
        height: media.height,
        variants: variants.map((variant) => ({
          width: variant.width,
          height: variant.height,
          format: variant.format,
          url: getMediaVariantUrl(variant.objectKey),
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
          }
        : null,
      images: images.filter((image) => image !== null),
    },
  })
})

export default router
