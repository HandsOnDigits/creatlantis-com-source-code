import { mainDb } from '../../src/prisma/main-db'
import { recordModerationAction } from './moderation-action.service'
import { getMediaTransferRecord } from './media-transfer.service'
import { deleteOriginalObject } from '../../../server/storage/b2.client'
import { sendModerationLiveEvent } from './live-event.service'

export async function rejectPost(
  postId: number,
  adminId: string,
  reason: string,
): Promise<void> {
  const normalizedReason = reason.trim()

  if (!normalizedReason) {
    throw new Error('A rejection reason is required.')
  }

  const post = await mainDb.orm.public.Post.where({ id: postId })
    .select(
      'id',
      'authorId',
      'publicationStatus',
      'reviewedByAdminId',
      'rejectionReason',
    )
    .first()

  if (!post) {
    throw new Error('Post not found.')
  }

  if (post.publicationStatus === 'APPROVED') {
    throw new Error('An approved post cannot be rejected.')
  }

  if (post.publicationStatus === 'PENDING_APPROVAL') {
    await mainDb.orm.public.Post.where({
      id: postId,
      publicationStatus: 'PENDING_APPROVAL',
    }).update({
      publicationStatus: 'REJECTED',
      reviewedAt: new Date().toISOString(),
      reviewedByAdminId: adminId,
      rejectionReason: normalizedReason,
    })
  }

  const rejectedPost = await mainDb.orm.public.Post.where({ id: postId })
    .select('publicationStatus', 'reviewedByAdminId', 'rejectionReason')
    .first()

  if (
    !rejectedPost ||
    rejectedPost.publicationStatus !== 'REJECTED' ||
    !rejectedPost.reviewedByAdminId ||
    !rejectedPost.rejectionReason
  ) {
    throw new Error('Post rejection could not be completed.')
  }

  await recordModerationAction({
    adminId: rejectedPost.reviewedByAdminId,
    action: 'CONTENT_REJECTED',
    targetType: 'POST',
    targetId: String(postId),
    reason: rejectedPost.rejectionReason,
  })

  await sendModerationLiveEvent({
    type: 'post.rejected',
    postId,
    authorId: post.authorId,
  })

  const postMedia = await mainDb.orm.public.PostMedia.where({
    postId,
  }).all()

  for (const item of postMedia) {
    const { media, variants } = await getMediaTransferRecord(item.mediaId)

    if (media.publicOriginalKey) {
      throw new Error('Rejected post unexpectedly has a public original.')
    }

    if (variants.some((variant) => variant.publicObjectKey)) {
      throw new Error('Rejected post unexpectedly has public variants.')
    }

    await deleteOriginalObject(media.originalKey)

    for (const variant of variants) {
      await deleteOriginalObject(variant.objectKey)
    }
  }
}
