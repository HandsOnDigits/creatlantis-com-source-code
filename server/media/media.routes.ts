import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

import { db } from '../../src/prisma/db'
import { requireAuth } from '../auth/auth.middleware'
import {
  createOriginalDownloadUrl,
  createOriginalUploadUrl,
  getOriginalObjectMetadata,
} from '../storage/b2.client'

const router = Router()

const MAX_FILE_SIZE = 10 * 1024 * 1024

const allowedContentTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

const createUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(allowedContentTypes),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
})

router.get('/:id/original', requireAuth, async (req, res) => {
  const mediaId = req.params.id
  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  if (
    typeof mediaId !== 'string' ||
    !z.string().uuid().safeParse(mediaId).success
  ) {
    return res.status(400).json({
      error: 'Invalid media ID',
    })
  }

  const media = await db.orm.public.Media.where({
    id: mediaId,
  }).first()

  if (
    !media ||
    media.userId !== userId ||
    !media.originalFileId ||
    media.status === 'DELETING'
  ) {
    return res.status(404).json({
      error: 'Media not found',
    })
  }

  const downloadUrl = await createOriginalDownloadUrl(media.originalKey)

  res.setHeader('Cache-Control', 'no-store')

  return res.status(200).json({
    data: {
      url: downloadUrl,
      expiresIn: 120,
    },
  })
})

router.post('/uploads', requireAuth, async (req, res) => {
  const parsed = createUploadSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid upload request.',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const { filename, contentType, size } = parsed.data
  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  const mediaId = randomUUID()
  const originalKey = `originals/${mediaId}/source`

  await db.orm.public.Media.create({
    id: mediaId,
    userId,
    originalKey,
    originalFilename: filename,
    originalMimeType: contentType,
    originalSize: BigInt(size),
  })

  try {
    const uploadUrl = await createOriginalUploadUrl(
      originalKey,
      contentType,
      size,
    )

    res.setHeader('Cache-Control', 'no-store')

    return res.status(201).json({
      data: {
        id: mediaId,
        uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        expiresIn: 300,
      },
    })
  } catch (error) {
    await db.orm.public.Media.where({ id: mediaId }).update({
      status: 'FAILED',
    })

    throw error
  }
})

router.post('/:id/complete', requireAuth, async (req, res) => {
  const mediaId = req.params.id
  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  if (
    typeof mediaId !== 'string' ||
    !z.string().uuid().safeParse(mediaId).success
  ) {
    return res.status(400).json({
      error: 'Invalid media ID',
    })
  }

  const media = await db.orm.public.Media.where({ id: mediaId }).first()

  if (!media || media.userId !== userId) {
    return res.status(404).json({
      error: 'Media not found',
    })
  }

  // Make completion requests idempotent.
  if (
    media.status === 'UPLOADED' ||
    media.status === 'PROCESSING' ||
    media.status === 'READY'
  ) {
    return res.status(200).json({
      data: {
        id: media.id,
        status: media.status,
      },
    })
  }

  if (media.status !== 'PENDING_UPLOAD') {
    return res.status(409).json({
      error: 'Media cannot be completed',
    })
  }

  let metadata

  try {
    metadata = await getOriginalObjectMetadata(media.originalKey)
  } catch {
    return res.status(409).json({
      error: 'The original file has not been uploaded yet',
    })
  }

  if (
    metadata.fileName !== media.originalKey ||
    metadata.contentType !== media.originalMimeType ||
    media.originalSize === null ||
    BigInt(metadata.contentLength) !== media.originalSize
  ) {
    return res.status(422).json({
      error: 'Uploaded file does not match the reserved upload',
    })
  }

  await db.orm.public.Media.where({ id: mediaId }).update({
    status: 'UPLOADED',
    originalFileId: metadata.fileId,
  })

  res.setHeader('Cache-Control', 'no-store')

  return res.status(200).json({
    data: {
      id: mediaId,
      status: 'UPLOADED',
    },
  })
})

export default router
