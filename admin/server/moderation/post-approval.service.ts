import { mainDb } from '../../src/prisma/main-db'
import { recordModerationAction } from './moderation-action.service'
import {
  getMediaTransferRecord,
  transferMediaToPublic,
} from './media-transfer.service'
import { deleteOriginalObject } from '../../../server/storage/b2.client'

export async function approvePost(
  postId: number,
  adminId: string,
): Promise<void> {
  const post = await mainDb.orm.public.Post.where({ id: postId })
    .select('id', 'publicationStatus', 'reviewedByAdminId')
    .first()

  if (!post) {
    throw new Error('Post not found.')
  }

  if (post.publicationStatus === 'REJECTED') {
    throw new Error('A rejected post cannot be approved.')
  }

  const postMedia = await mainDb.orm.public.PostMedia.where({ postId }).all()

  for (const item of postMedia) {
    await transferMediaToPublic(item.mediaId)
  }

  if (post.publicationStatus === 'PENDING_APPROVAL') {
    await mainDb.orm.public.Post.where({
      id: postId,
      publicationStatus: 'PENDING_APPROVAL',
    }).update({
      publicationStatus: 'APPROVED',
      reviewedAt: new Date().toISOString(),
      reviewedByAdminId: adminId,
      rejectionReason: null,
    })
  }

  // Read the persisted decision. This also recovers an interrupted approval.
  const approvedPost = await mainDb.orm.public.Post.where({ id: postId })
    .select('publicationStatus', 'reviewedByAdminId')
    .first()

  if (
    !approvedPost ||
    approvedPost.publicationStatus !== 'APPROVED' ||
    !approvedPost.reviewedByAdminId
  ) {
    throw new Error('Post approval could not be completed.')
  }

  // Always attribute the decision to the moderator who actually approved it.
  await recordModerationAction({
    adminId: approvedPost.reviewedByAdminId,
    action: 'CONTENT_APPROVED',
    targetType: 'POST',
    targetId: String(postId),
  })

  // Staging cleanup happens only after the public copies are verified,
  // the post is approved, and the moderation action has been recorded.
  const approvedPostMedia = await mainDb.orm.public.PostMedia.where({
    postId,
  }).all()

  for (const item of approvedPostMedia) {
    const { media, variants } = await getMediaTransferRecord(item.mediaId)

    await deleteOriginalObject(media.originalKey)

    for (const variant of variants) {
      await deleteOriginalObject(variant.objectKey)
    }
  }
}
