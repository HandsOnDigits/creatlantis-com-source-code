import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

import { db } from '../../src/prisma/db'
import { requireAuth } from '../auth/auth.middleware'
import {
  createOriginalUploadUrl,
  deleteOriginalObject,
  getOriginalObjectMetadata,
} from '../storage/b2.client'

const router = Router()

const MAX_AVATAR_SIZE = 10 * 1024 * 1024
const UPLOAD_LIFETIME_MS = 15 * 60 * 1000

const allowedContentTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

const createAvatarUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(allowedContentTypes),
  size: z.number().int().positive().max(MAX_AVATAR_SIZE),
})

router.post('/upload', requireAuth, async (req, res) => {
  const parsed = createAvatarUploadSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid avatar upload request.',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  const { filename, contentType, size } = parsed.data

  const uploadId = randomUUID()
  const objectKey = `avatars/${userId}/${uploadId}/source`
  const expiresAt = new Date(Date.now() + UPLOAD_LIFETIME_MS).toISOString()

  try {
    await db.orm.public.AvatarUploadReservation.create({
      id: uploadId,
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
          id: uploadId,
          uploadUrl,
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          expiresAt,
          expiresIn: 300,
        },
      })
    } catch (error) {
      await db.orm.public.AvatarUploadReservation.where({
        id: uploadId,
        userId,
      }).delete()

      throw error
    }
  } catch (error) {
    console.error('Failed to create avatar upload reservation:', error)

    return res.status(500).json({
      error: 'Failed to prepare the avatar upload.',
    })
  }
})

router.post('/complete', requireAuth, async (req, res) => {
  const schema = z.object({
    id: z.string().uuid(),
  })

  const parsed = schema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid avatar upload ID.',
    })
  }

  const userId = req.auth?.userId

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
    })
  }

  const { id } = parsed.data

  const reservation = await db.orm.public.AvatarUploadReservation.where({
    id,
    userId,
  }).first()

  if (!reservation) {
    return res.status(404).json({
      error: 'Avatar upload reservation not found.',
    })
  }

  if (new Date(reservation.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({
      error: 'Avatar upload reservation has expired.',
    })
  }

  let metadata

  try {
    metadata = await getOriginalObjectMetadata(reservation.objectKey)
  } catch (error) {
    console.error('Failed to verify avatar upload:', error)

    return res.status(400).json({
      error: 'Uploaded avatar could not be verified.',
    })
  }

  const actualSize = Number(metadata.contentLength)

  if (
    metadata.fileName !== reservation.objectKey ||
    !metadata.fileId ||
    metadata.contentType !== reservation.contentType ||
    !Number.isSafeInteger(actualSize) ||
    actualSize !== Number(reservation.size)
  ) {
    return res.status(400).json({
      error: 'Uploaded avatar metadata does not match the reservation.',
    })
  }

  let previousStagingKey: string | null = null

  try {
    const completed = await db.transaction(async (tx) => {
      const claimed = await tx.orm.public.AvatarUploadReservation.where({
        id,
        userId,
      }).delete()

      if (!claimed) {
        return false
      }

      const existingAvatar = await tx.orm.public.UserAvatar.where({
        userId,
      }).first()

      if (existingAvatar) {
        previousStagingKey = existingAvatar.stagingObjectKey

        await tx.orm.public.UserAvatar.where({ userId }).update({
          stagingObjectKey: reservation.objectKey,
          stagingFileId: metadata.fileId,
          originalFilename: reservation.filename,
          mimeType: reservation.contentType,
          size: BigInt(actualSize),
          width: null,
          height: null,
          status: 'PENDING_APPROVAL',
          rejectionReason: null,
          reviewedAt: null,
          reviewedByAdminId: null,
        })
      } else {
        await tx.orm.public.UserAvatar.create({
          id: randomUUID(),
          userId,
          stagingObjectKey: reservation.objectKey,
          stagingFileId: metadata.fileId,
          originalFilename: reservation.filename,
          mimeType: reservation.contentType,
          size: BigInt(actualSize),
          status: 'PENDING_APPROVAL',
        })
      }

      return true
    })

    if (!completed) {
      return res.status(409).json({
        error: 'Avatar upload reservation has already been consumed.',
      })
    }

    // Remove the previous pending replacement, if one existed.
    if (previousStagingKey && previousStagingKey !== reservation.objectKey) {
      try {
        await deleteOriginalObject(previousStagingKey)
      } catch (error) {
        console.error('Failed to delete previous staging avatar:', error)
      }
    }

    res.setHeader('Cache-Control', 'no-store')

    return res.status(200).json({
      data: {
        status: 'PENDING_APPROVAL',
        message: 'Avatar submitted for administrator approval.',
      },
    })
  } catch (error) {
    console.error('Failed to complete avatar upload:', error)

    return res.status(500).json({
      error: 'Failed to complete avatar upload.',
    })
  }
})

export default router
