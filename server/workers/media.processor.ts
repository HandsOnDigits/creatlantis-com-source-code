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

  const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation ?? 0)

  const width = swapsDimensions ? metadata.height : metadata.width
  const height = swapsDimensions ? metadata.width : metadata.height

  const variantWidths: number[] = VARIANT_WIDTHS.filter(
    (targetWidth) => targetWidth <= width,
  )

  if (variantWidths.length === 0) {
    variantWidths.push(width)
  }

  const variants: {
    mediaId: string
    objectKey: string
    fileId: string
    format: 'WEBP'
    width: number
    height: number
    size: bigint
  }[] = []

  for (const targetWidth of variantWidths) {
    const output = await sharp(original, {
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .resize({
        width: targetWidth,
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })

    const objectKey = `media/${job.id}/v1/${targetWidth}.webp`

    const uploaded = await uploadMediaVariant(
      objectKey,
      output.data,
      'image/webp',
    )

    variants.push({
      mediaId: job.id,
      objectKey,
      fileId: uploaded.fileId,
      format: 'WEBP',
      width: output.info.width,
      height: output.info.height,
      size: BigInt(output.data.byteLength),
    })
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
