import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../src/prisma/db'
import { mainDb } from '../../src/prisma/main-db'
import { requireMfaVerifiedAdmin } from '../middleware/auth.middleware'
import { requireModerator } from '../middleware/require-moderator'
import { createOriginalDownloadUrl } from '../../../server/storage/b2.client'
import { approvePost } from './post-approval.service'
import { rejectPost } from './post-rejection.service'
import { ReportStatusError, updateReportStatus } from './report-status.service'

const router = Router()

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

function registerReportStatusRoute(
  path: string,
  status: 'RESOLVED' | 'DISMISSED',
) {
  router.post(
    path,
    requireMfaVerifiedAdmin,
    requireModerator,
    async (req, res, next) => {
      try {
        const parsedId = z.string().uuid().safeParse(req.params.reportId)

        const parsedBody = z
          .object({
            reason: z.string().trim().min(1).max(2000),
          })
          .safeParse(req.body)

        if (!parsedId.success) {
          return res.status(400).json({
            error: 'Invalid report ID.',
          })
        }

        if (!parsedBody.success) {
          return res.status(400).json({
            error: 'A valid explanation is required.',
          })
        }

        if (!req.adminAuth) {
          return res.status(401).json({
            error: 'Authentication required.',
          })
        }

        const result = await updateReportStatus({
          reportId: parsedId.data,
          adminId: req.adminAuth.adminId,
          status,
          reason: parsedBody.data.reason,
        })

        return res.json({
          success: true,
          ...result,
        })
      } catch (error) {
        if (error instanceof ReportStatusError) {
          return res.status(error.statusCode).json({
            error: error.message,
          })
        }

        next(error)
      }
    },
  )
}

registerReportStatusRoute('/reports/:reportId/resolve', 'RESOLVED')
registerReportStatusRoute('/reports/:reportId/dismiss', 'DISMISSED')

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
                originalSize: Number(record.originalSize),
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

router.get(
  '/reports',
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

      const status = z
        .enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'])
        .optional()
        .safeParse(req.query.status)

      if (!page.success || !limit.success || !status.success) {
        return res.status(400).json({
          error: 'Invalid report query parameters.',
        })
      }

      const reports = await db.orm.public.Report.where(
        status.data ? { status: status.data } : {},
      )
        .select(
          'id',
          'reporterUserId',
          'targetType',
          'targetId',
          'reason',
          'description',
          'status',
          'assignedToAdminId',
          'createdAt',
          'updatedAt',
        )
        .orderBy([
          (report) => report.createdAt.asc(),
          (report) => report.id.asc(),
        ])
        .limit(limit.data + 1)
        .offset((page.data - 1) * limit.data)
        .all()

      const hasMore = reports.length > limit.data

      return res.json({
        data: reports.slice(0, limit.data),
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

router.get(
  '/reports/:reportId',
  requireMfaVerifiedAdmin,
  requireModerator,
  async (req, res, next) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.reportId)

      if (!parsedId.success) {
        return res.status(400).json({
          error: 'Invalid report ID.',
        })
      }

      const report = await db.orm.public.Report.where({
        id: parsedId.data,
      })
        .select(
          'id',
          'reporterUserId',
          'targetType',
          'targetId',
          'reason',
          'description',
          'status',
          'assignedToAdminId',
          'createdAt',
          'updatedAt',
        )
        .first()

      if (!report) {
        return res.status(404).json({
          error: 'Report not found.',
        })
      }

      let target: unknown = null

      if (report.targetType === 'USER') {
        const userId = Number(report.targetId)

        if (Number.isSafeInteger(userId) && userId > 0) {
          const user = await mainDb.orm.public.User.where({
            id: userId,
          })
            .select('id', 'username', 'name', 'nameIsPublic', 'createdAt')
            .first()

          if (user) {
            target = {
              id: user.id,
              username: user.username,
              name: user.nameIsPublic ? user.name : null,
              createdAt: user.createdAt,
            }
          }
        }
      }

      if (report.targetType === 'POST') {
        const postId = Number(report.targetId)

        if (Number.isSafeInteger(postId) && postId > 0) {
          const post = await mainDb.orm.public.Post.where({
            id: postId,
          })
            .select(
              'id',
              'type',
              'title',
              'content',
              'authorId',
              'publicationStatus',
              'createdAt',
            )
            .first()

          if (post) {
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
                })
                  .select(
                    'id',
                    'originalFilename',
                    'originalMimeType',
                    'originalSize',
                    'width',
                    'height',
                    'status',
                  )
                  .first()

                if (!record) return null

                return {
                  id: record.id,
                  originalFilename: record.originalFilename,
                  originalMimeType: record.originalMimeType,
                  originalSize: Number(record.originalSize),
                  width: record.width,
                  height: record.height,
                  status: record.status,
                }
              }),
            )

            target = {
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
          }
        }
      }

      if (report.targetType === 'MEDIA') {
        const mediaRecord = await mainDb.orm.public.Media.where({
          id: report.targetId,
        })
          .select(
            'id',
            'userId',
            'originalFilename',
            'originalMimeType',
            'originalSize',
            'width',
            'height',
            'status',
            'createdAt',
          )
          .first()

        if (mediaRecord) {
          const postMedia = await mainDb.orm.public.PostMedia.where({
            mediaId: mediaRecord.id,
          })
            .select('postId')
            .first()

          const post = postMedia
            ? await mainDb.orm.public.Post.where({
                id: postMedia.postId,
              })
                .select('id', 'title', 'publicationStatus', 'authorId')
                .first()
            : null

          target = {
            id: mediaRecord.id,
            userId: mediaRecord.userId,
            originalFilename: mediaRecord.originalFilename,
            originalMimeType: mediaRecord.originalMimeType,
            originalSize: Number(mediaRecord.originalSize),
            width: mediaRecord.width,
            height: mediaRecord.height,
            status: mediaRecord.status,
            createdAt: mediaRecord.createdAt,
            post: post
              ? {
                  id: post.id,
                  title: post.title,
                  publicationStatus: post.publicationStatus,
                  authorId: post.authorId,
                }
              : null,
          }
        }
      }

      return res.json({
        data: {
          ...report,
          target,
          targetAvailable: target !== null,
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

router.post(
  '/:postId/reject',
  requireMfaVerifiedAdmin,
  requireModerator,
  async (req, res, next) => {
    try {
      const parsedPostId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.postId)

      const parsedBody = z
        .object({
          reason: z.string().trim().min(1).max(2000),
        })
        .safeParse(req.body)

      if (!parsedPostId.success) {
        return res.status(400).json({ error: 'Invalid post ID.' })
      }

      if (!parsedBody.success) {
        return res.status(400).json({
          error: 'A rejection reason is required.',
        })
      }

      if (!req.adminAuth) {
        return res.status(401).json({
          error: 'Authentication required.',
        })
      }

      await rejectPost(
        parsedPostId.data,
        req.adminAuth.adminId,
        parsedBody.data.reason,
      )

      return res.json({
        success: true,
        postId: parsedPostId.data,
        publicationStatus: 'REJECTED',
      })
    } catch (error) {
      next(error)
    }
  },
)

export default router
