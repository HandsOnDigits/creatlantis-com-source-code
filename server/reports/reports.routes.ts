import { Router } from 'express'

import { db } from '../../src/prisma/db'
import { requireAuth } from '../auth/auth.middleware'
import { submitReport } from './report-submission.service'
import { createReportSchema } from './reports.validation'

const router = Router()

router.post('/', requireAuth, async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid report submission',
      details: parsed.error.flatten(),
    })
    return
  }

  const { targetType, targetId, reason, description } = parsed.data

  let targetExists = false

  if (targetType === 'USER') {
    targetExists = Boolean(
      await db.orm.public.User.where({ id: Number(targetId) })
        .select('id')
        .first(),
    )
  }

  if (targetType === 'POST') {
    targetExists = Boolean(
      await db.orm.public.Post.where({
        id: Number(targetId),
        publicationStatus: 'APPROVED',
      })
        .select('id')
        .first(),
    )
  }

  if (targetType === 'MEDIA') {
    const media = await db.orm.public.Media.where({
      id: targetId,
      status: 'READY',
    })
      .select('id')
      .first()

    if (media) {
      const postMedia = await db.orm.public.PostMedia.where({
        mediaId: targetId,
      })
        .select('postId')
        .first()

      if (postMedia) {
        targetExists = Boolean(
          await db.orm.public.Post.where({
            id: postMedia.postId,
            publicationStatus: 'APPROVED',
          })
            .select('id')
            .first(),
        )
      }
    }
  }

  if (!targetExists) {
    res.status(404).json({
      error: 'Report target not found or unavailable',
    })
    return
  }

  const reportId = await submitReport({
    reporterUserId: req.auth!.userId,
    targetType,
    targetId,
    reason,
    description,
  })

  res.status(201).json({
    data: {
      id: reportId,
      status: 'PENDING',
    },
  })
})

export default router
