import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'
import { getMediaVariantUrl } from '../storage/b2.client'

const router = Router()

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

  const posts = await db.orm.public.Post.select(
    'id',
    'title',
    'content',
    'createdAt',
    'authorId',
  )
    .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()])
    .limit(pageSize + 1)
    .offset(offset)
    .all()

  const hasMore = posts.length > pageSize
  const pagePosts = posts.slice(0, pageSize)

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

// Get post with its processed images
router.get('/:id', async (req, res) => {
  const id = parsePostId(req.params.id)

  if (id === null) {
    return res.status(400).json({ error: 'Invalid post ID' })
  }

  const post = await db.orm.public.Post.where({ id })
    .select('id', 'title', 'content', 'createdAt', 'authorId')
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
