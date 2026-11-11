import { randomUUID } from 'node:crypto'

import { mainDb } from '../../src/prisma/main-db'
import {
  downloadOriginalBuffer,
  uploadPublicObject,
  verifyPublicObject,
} from '../../../server/storage/b2.client'

const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024

function createPublicObjectKey(
  mediaId: string,
  type: 'originals' | 'variants',
  filename: string,
): string {
  return `media/${mediaId}/approved/${type}/${randomUUID()}/${filename}`
}

export async function getMediaTransferRecord(mediaId: string) {
  const media = await mainDb.orm.public.Media.where({
    id: mediaId,
  })
    .select(
      'id',
      'status',
      'originalKey',
      'originalMimeType',
      'originalSize',
      'publicOriginalKey',
    )
    .first()

  if (!media) {
    throw new Error('Media record not found.')
  }

  if (media.status !== 'READY') {
    throw new Error('Media is not ready for publication.')
  }

  const variants = await mainDb.orm.public.MediaVariant.where({
    mediaId,
  })
    .select(
      'id',
      'objectKey',
      'publicObjectKey',
      'format',
      'width',
      'height',
      'size',
    )
    .all()

  if (variants.length === 0) {
    throw new Error('Media has no processed variants.')
  }

  return { media, variants }
}

export async function transferMediaToPublic(mediaId: string): Promise<void> {
  const { media, variants } = await getMediaTransferRecord(mediaId)

  // Reserve a stable public key for the original.
  let originalPublicKey = media.publicOriginalKey

  if (!originalPublicKey) {
    const candidate = createPublicObjectKey(media.id, 'originals', 'original')

    await mainDb.orm.public.Media.where({
      id: media.id,
      publicOriginalKey: null,
    }).update({ publicOriginalKey: candidate })

    const updated = await mainDb.orm.public.Media.where({ id: media.id })
      .select('publicOriginalKey')
      .first()

    if (!updated?.publicOriginalKey) {
      throw new Error('Could not reserve the public original key.')
    }

    originalPublicKey = updated.publicOriginalKey
  }

  const originalContentLength = media.originalSize

  if (originalContentLength === null) {
    throw new Error('Original media size is missing.')
  }

  // Reuse an already uploaded and verified public original.
  const originalExists = await verifyPublicObject(
    originalPublicKey,
    Number(originalContentLength),
    media.originalMimeType,
  )

  if (!originalExists) {
    const originalBuffer = await downloadOriginalBuffer(
      media.originalKey,
      MAX_ORIGINAL_SIZE,
    )

    if (BigInt(originalBuffer.byteLength) !== originalContentLength) {
      throw new Error('Original media size does not match its database record.')
    }

    await uploadPublicObject(
      originalPublicKey,
      originalBuffer,
      media.originalMimeType,
    )

    const verified = await verifyPublicObject(
      originalPublicKey,
      originalBuffer.byteLength,
      media.originalMimeType,
    )

    if (!verified) {
      throw new Error('Public original could not be verified after upload.')
    }
  }

  // Reserve, verify, and upload every variant.
  for (const variant of variants) {
    let publicKey = variant.publicObjectKey

    if (!publicKey) {
      const extension = variant.format === 'WEBP' ? 'webp' : 'avif'

      const candidate = createPublicObjectKey(
        media.id,
        'variants',
        `${variant.width}.${extension}`,
      )

      await mainDb.orm.public.MediaVariant.where({
        id: variant.id,
        publicObjectKey: null,
      }).update({ publicObjectKey: candidate })

      const updated = await mainDb.orm.public.MediaVariant.where({
        id: variant.id,
      })
        .select('publicObjectKey')
        .first()

      if (!updated?.publicObjectKey) {
        throw new Error(
          `Could not reserve the public key for variant ${variant.id}.`,
        )
      }

      publicKey = updated.publicObjectKey
    }

    const contentType = variant.format === 'WEBP' ? 'image/webp' : 'image/avif'

    // Skip upload when the public variant is already verified.
    const variantExists = await verifyPublicObject(
      publicKey,
      Number(variant.size),
      contentType,
    )

    if (variantExists) {
      continue
    }

    const variantBuffer = await downloadOriginalBuffer(
      variant.objectKey,
      MAX_ORIGINAL_SIZE,
    )

    if (BigInt(variantBuffer.byteLength) !== variant.size) {
      throw new Error(
        `Variant ${variant.id} size does not match its database record.`,
      )
    }

    await uploadPublicObject(publicKey, variantBuffer, contentType)

    const verified = await verifyPublicObject(
      publicKey,
      variantBuffer.byteLength,
      contentType,
    )

    if (!verified) {
      throw new Error(
        `Public variant ${variant.id} could not be verified after upload.`,
      )
    }
  }
}
