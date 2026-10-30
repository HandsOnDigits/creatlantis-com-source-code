import sharp from 'sharp'

import { db } from '../../src/prisma/db'
import {
  downloadOriginalBuffer,
  uploadMediaVariant,
} from '../storage/b2.client'

import type { MediaJob } from './media.worker'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000

const VARIANT_WIDTHS = [320, 960, 1600] as const

const FORMATS = [
  {
    name: 'webp',
    mimeType: 'image/webp',
    extension: 'webp',
    quality: 82,
  },
  {
    name: 'avif',
    mimeType: 'image/avif',
    extension: 'avif',
    quality: 55,
  },
] as const

export async function processMediaJob(job: MediaJob): Promise<void> {
  const original = await downloadOriginalBuffer(
    job.originalKey,
    MAX_IMAGE_BYTES,
  )

  const image = sharp(original, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    animated: false,
  })

  const metadata = await image.metadata()

  if (
    !metadata.width ||
    !metadata.height ||
    !metadata.format ||
    !['jpeg', 'png', 'webp'].includes(metadata.format)
  ) {
    throw new Error('Unsupported or invalid image')
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new Error('Animated images are not supported')
  }

  const width = metadata.width
  const height = metadata.height

  const variants: {
    mediaId: string
    objectKey: string
    fileId: string
    format: 'WEBP' | 'AVIF'
    width: number
    height: number
    size: bigint
  }[] = []

  for (const targetWidth of VARIANT_WIDTHS) {
    if (targetWidth > width) continue

    for (const format of FORMATS) {
      const output = await sharp(original, {
        limitInputPixels: MAX_IMAGE_PIXELS,
      })
        .rotate()
        .resize({
          width: targetWidth,
          withoutEnlargement: true,
        })
        .toFormat(format.name, {
          quality: format.quality,
        })
        .toBuffer({ resolveWithObject: true })

      const objectKey = `media/${job.id}/v1/${format.extension}/${targetWidth}.${format.extension}`

      const uploaded = await uploadMediaVariant(
        objectKey,
        output.data,
        format.mimeType,
      )

      variants.push({
        mediaId: job.id,
        objectKey,
        fileId: uploaded.fileId,
        format: format.name.toUpperCase() as 'WEBP' | 'AVIF',
        width: output.info.width,
        height: output.info.height,
        size: BigInt(output.data.byteLength),
      })
    }
  }

  if (variants.length === 0) {
    throw new Error('No image variants were generated')
  }

  await db.transaction(async (tx) => {
    const media = tx.orm.public.Media
    const mediaVariants = tx.orm.public.MediaVariant

    await mediaVariants.createAll(variants)

    await media.where({ id: job.id }).update({
      width,
      height,
      status: 'READY',
      processedAt: new Date().toISOString(),
      processingError: null,
      nextAttemptAt: null,
    })
  })
}
