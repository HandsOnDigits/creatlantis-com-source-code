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
const RESERVATION_LIFETIME_MS = 15 * 60 * 1000

const allowedContentTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

const createUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(allowedContentTypes),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
})

// Retrieve media processing status and available variants.
router.get('/:id/status', requireAuth, async (req, res) => {
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

  if (!media || media.userId !== userId || media.status === 'DELETING') {
    return res.status(404).json({
      error: 'Media not found',
    })
  }

  const variants = await db.orm.public.MediaVariant.where({ mediaId })
    .orderBy((variant) => variant.width.asc())
    .all()

  const variantData = await Promise.all(
    variants.map(async (variant) => ({
      format: variant.format,
      width: variant.width,
      height: variant.height,
      size: Number(variant.size),
      url: await createOriginalDownloadUrl(variant.objectKey),
      expiresIn: 120,
    })),
  )

  res.setHeader('Cache-Control', 'no-store')

  return res.status(200).json({
    data: {
      id: media.id,
      status: media.status,
      width: media.width,
      height: media.height,
      processingAttempts: media.processingAttempts,
      processingError: media.processingError,
      processedAt: media.processedAt,
      variants: variantData,
    },
  })
})

// Retrieve an original image.
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

// Create a temporary upload reservation.
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

  const reservationId = randomUUID()
  const objectKey = `originals/${reservationId}/source`
  const expiresAt = new Date(Date.now() + RESERVATION_LIFETIME_MS).toISOString()

  await db.orm.public.UploadReservation.create({
    id: reservationId,
    userId,
    objectKey,
    filename,
    contentType,
    size: BigInt(size),
    expiresAt,
  })

  try {
    const uploadUrl = await createOriginalUploadUrl(
      objectKey,
      contentType,
      size,
    )

    res.setHeader('Cache-Control', 'no-store')

    return res.status(201).json({
      data: {
        id: reservationId,
        uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        expiresIn: 300,
      },
    })
  } catch (error) {
    await db.orm.public.UploadReservation.where({
      id: reservationId,
    }).delete()

    throw error
  }
})

router.delete('/uploads/:id', requireAuth, async (req, res) => {
  const reservationId = req.params.id
  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  if (
    typeof reservationId !== 'string' ||
    !z.string().uuid().safeParse(reservationId).success
  ) {
    return res.status(400).json({
      error: 'Invalid upload reservation ID',
    })
  }

  const reservation = await db.orm.public.UploadReservation.where({
    id: reservationId,
  }).first()

  if (!reservation || reservation.userId !== userId) {
    return res.status(404).json({
      error: 'Upload reservation not found',
    })
  }

  // Expire immediately so completion requests are rejected.
  await db.orm.public.UploadReservation.where({
    id: reservationId,
  }).update({
    expiresAt: new Date().toISOString(),
  })

  return res.status(204).send()
})

// Verify the B2 upload and create permanent media metadata.
router.post('/:id/complete', requireAuth, async (req, res) => {
  const reservationId = req.params.id
  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  if (
    typeof reservationId !== 'string' ||
    !z.string().uuid().safeParse(reservationId).success
  ) {
    return res.status(400).json({
      error: 'Invalid upload reservation ID',
    })
  }

  const existingMedia = await db.orm.public.Media.where({
    id: reservationId,
  }).first()

  if (existingMedia) {
    if (existingMedia.userId !== userId) {
      return res.status(404).json({
        error: 'Upload reservation not found',
      })
    }

    // Clean up a leftover reservation from a previous completion.
    await db.orm.public.UploadReservation.where({
      id: reservationId,
    }).delete()

    return res.status(200).json({
      data: {
        id: existingMedia.id,
        status: existingMedia.status,
      },
    })
  }

  const reservation = await db.orm.public.UploadReservation.where({
    id: reservationId,
  }).first()

  if (!reservation || reservation.userId !== userId) {
    return res.status(404).json({
      error: 'Upload reservation not found',
    })
  }

  if (new Date(reservation.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({
      error: 'Upload reservation has expired',
    })
  }

  let metadata

  try {
    metadata = await getOriginalObjectMetadata(reservation.objectKey)
  } catch (error) {
    const details =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : String(error)

    console.error('B2 metadata verification failed:', details)

    return res.status(500).json({
      error: 'B2 metadata verification failed.',
      details,
    })
  }

  if (
    metadata.fileName !== reservation.objectKey ||
    metadata.contentType !== reservation.contentType ||
    metadata.contentLength == null ||
    BigInt(metadata.contentLength) !== BigInt(reservation.size) ||
    !metadata.fileId
  ) {
    return res.status(422).json({
      error: 'Uploaded file does not match the reserved upload',
    })
  }

  // Only create permanent Media metadata after B2 verification.
  await db.orm.public.Media.create({
    id: reservation.id,
    userId: reservation.userId,
    originalKey: reservation.objectKey,
    originalFileId: metadata.fileId,
    originalFilename: reservation.filename,
    originalMimeType: reservation.contentType,
    originalSize: BigInt(reservation.size),
    status: 'UPLOADED',
  })

  await db.orm.public.UploadReservation.where({
    id: reservation.id,
  }).delete()

  res.setHeader('Cache-Control', 'no-store')

  return res.status(200).json({
    data: {
      id: reservation.id,
      status: 'UPLOADED',
    },
  })
})

export default router
