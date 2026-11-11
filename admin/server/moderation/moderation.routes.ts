import { Router } from 'express'
import { z } from 'zod'

import { mainDb } from '../../src/prisma/main-db'
import { requireMfaVerifiedAdmin } from '../middleware/auth.middleware'
import { requireModerator } from '../middleware/require-moderator'
import { createOriginalDownloadUrl } from '../../../server/storage/b2.client'
import { approvePost } from './post-approval.service'

const router = Router()

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

router.get(
  '/pending',
  requireMfaVerifiedAdmin,
  requireModerator,
  async (req, res, next) => {
    try {
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
          error: 'Invalid pagination parameters.',
        })
      }

      const posts = await mainDb.orm.public.Post.where({
        publicationStatus: 'PENDING_APPROVAL',
      })
        .select('id', 'type', 'title', 'content', 'createdAt', 'authorId')
        .orderBy([(post) => post.createdAt.asc(), (post) => post.id.asc()])
        .limit(limit.data + 1)
        .offset((page.data - 1) * limit.data)
        .all()

      const hasMore = posts.length > limit.data

      const data = await Promise.all(
        posts.slice(0, limit.data).map(async (post) => {
          const author = await mainDb.orm.public.User.where({
            id: post.authorId,
          })
            .select('id', 'username', 'name', 'nameIsPublic')
            .first()

          const postMedia = await mainDb.orm.public.PostMedia.where({
            postId: post.id,
          })
            .orderBy((item) => item.position.asc())
            .all()

          const media = await Promise.all(
            postMedia.map(async (item) => {
              const record = await mainDb.orm.public.Media.where({
                id: item.mediaId,
                status: 'READY',
              })
                .select(
                  'id',
                  'originalKey',
                  'originalFilename',
                  'originalMimeType',
                  'originalSize',
                  'width',
                  'height',
                )
                .first()

              if (!record) return null

              const variants = await mainDb.orm.public.MediaVariant.where({
                mediaId: record.id,
              })
                .orderBy((variant) => variant.width.asc())
                .select('width', 'height', 'format', 'objectKey')
                .all()

              const originalUrl = await createOriginalDownloadUrl(
                record.originalKey,
              )

              const signedVariants = await Promise.all(
                variants.map(async (variant) => ({
                  width: variant.width,
                  height: variant.height,
                  format: variant.format,
                  url: await createOriginalDownloadUrl(variant.objectKey),
                })),
              )

              return {
                id: record.id,
                originalFilename: record.originalFilename,
                originalMimeType: record.originalMimeType,
                originalSize: record.originalSize,
                width: record.width,
                height: record.height,
                originalUrl,
                variants: signedVariants,
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
            media: media.filter((item) => item !== null),
          }
        }),
      )

      return res.json({
        data,
        pagination: {
          page: page.data,
          limit: limit.data,
          hasMore,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/:postId/approve',
  requireMfaVerifiedAdmin,
  requireModerator,
  async (req, res, next) => {
    try {
      const parsed = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.postId)

      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid post ID.',
        })
      }

      if (!req.adminAuth) {
        return res.status(401).json({
          error: 'Authentication required.',
        })
      }

      await approvePost(parsed.data, req.adminAuth.adminId)

      return res.json({
        success: true,
        postId: parsed.data,
        publicationStatus: 'APPROVED',
      })
    } catch (error) {
      next(error)
    }
  },
)

export default router
