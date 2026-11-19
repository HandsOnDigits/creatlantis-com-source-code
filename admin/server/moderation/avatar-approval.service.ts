import { randomUUID } from 'node:crypto'

import { mainDb } from '../../src/prisma/main-db'
import { recordModerationAction } from './moderation-action.service'

import {
  deleteOriginalObject,
  downloadOriginalBuffer,
  uploadPublicObject,
  verifyPublicObject,
} from '../../../server/storage/b2.client'

import { sendModerationLiveEvent } from './live-event.service'

const MAX_AVATAR_SIZE = 5 * 1024 * 1024

function createPendingPublicObjectKey(
  userId: number,
  avatarId: string,
): string {
  return `avatars/${userId}/approved/${avatarId}/${randomUUID()}/source`
}

async function getAvatar(avatarId: string) {
  const avatar = await mainDb.orm.public.UserAvatar.where({
    id: avatarId,
  })
    .select(
      'id',
      'userId',
      'status',
      'publicObjectKey',
      'stagingObjectKey',
      'pendingPublicObjectKey',
      'mimeType',
      'size',
      'rejectionReason',
      'reviewedByAdminId',
    )
    .first()

  if (!avatar) {
    throw new Error('Avatar not found.')
  }

  return avatar
}

export async function approveAvatar(
  avatarId: string,
  adminId: string,
): Promise<void> {
  let avatar = await getAvatar(avatarId)

  if (avatar.status === 'REJECTED') {
    throw new Error('A rejected avatar cannot be approved.')
  }

  if (avatar.status === 'APPROVED' && !avatar.stagingObjectKey) {
    return
  }

  if (!avatar.stagingObjectKey || !avatar.mimeType || avatar.size === null) {
    throw new Error('Avatar staging data is incomplete.')
  }

  const expectedSize = Number(avatar.size)

  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize <= 0 ||
    expectedSize > MAX_AVATAR_SIZE
  ) {
    throw new Error('Avatar has an invalid or excessive size.')
  }

  const stagingKey = avatar.stagingObjectKey
  const mimeType = avatar.mimeType

  // Reserve a stable public destination without changing the active avatar.
  if (!avatar.pendingPublicObjectKey) {
    const pendingPublicObjectKey = createPendingPublicObjectKey(
      avatar.userId,
      avatar.id,
    )

    await mainDb.orm.public.UserAvatar.where({
      id: avatar.id,
      status: 'PENDING_APPROVAL',
      pendingPublicObjectKey: null,
    }).update({
      pendingPublicObjectKey,
    })

    avatar = await getAvatar(avatarId)
  }

  const publicKey = avatar.pendingPublicObjectKey

  if (!publicKey) {
    throw new Error('Could not reserve a public avatar destination.')
  }

  const alreadyUploaded = await verifyPublicObject(
    publicKey,
    expectedSize,
    mimeType,
  )

  if (!alreadyUploaded) {
    const buffer = await downloadOriginalBuffer(stagingKey, MAX_AVATAR_SIZE)

    if (buffer.byteLength !== expectedSize) {
      throw new Error('Avatar size does not match its database record.')
    }

    await uploadPublicObject(publicKey, buffer, mimeType)

    const verified = await verifyPublicObject(publicKey, expectedSize, mimeType)

    if (!verified) {
      throw new Error('Public avatar upload could not be verified.')
    }
  }

  const updated = await mainDb.orm.public.UserAvatar.where({
    id: avatar.id,
    status: 'PENDING_APPROVAL',
    pendingPublicObjectKey: publicKey,
  }).update({
    publicObjectKey: publicKey,
    pendingPublicObjectKey: null,
    publicFileId: null,
    stagingObjectKey: null,
    stagingFileId: null,
    status: 'APPROVED',
    rejectionReason: null,
    reviewedAt: new Date().toISOString(),
    reviewedByAdminId: adminId,
  })

  const approved = await getAvatar(avatarId)

  if (
    approved.status !== 'APPROVED' ||
    approved.publicObjectKey !== publicKey
  ) {
    throw new Error('Avatar approval could not be completed.')
  }

  await recordModerationAction({
    adminId,
    action: 'CONTENT_APPROVED',
    targetType: 'AVATAR',
    targetId: avatar.id,
  })

  // The staging key was saved before the approval update cleared it.
  // Re-read the original key from the initial record.
  if (avatar.stagingObjectKey) {
    await deleteOriginalObject(avatar.stagingObjectKey)
  }

  void updated
}

export async function rejectAvatar(
  avatarId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  const normalizedReason = reason.trim()

  if (!normalizedReason) {
    throw new Error('A rejection reason is required.')
  }

  const avatar = await getAvatar(avatarId)

  if (avatar.status === 'APPROVED') {
    throw new Error('An approved avatar cannot be rejected.')
  }

  if (avatar.status === 'REJECTED') {
    if (avatar.rejectionReason !== normalizedReason) {
      throw new Error('Avatar has already been rejected.')
    }

    return
  }

  if (avatar.status !== 'PENDING_APPROVAL') {
    throw new Error('Avatar is not awaiting approval.')
  }

  const stagingKey = avatar.stagingObjectKey

  await mainDb.orm.public.UserAvatar.where({
    id: avatar.id,
    status: 'PENDING_APPROVAL',
  }).update({
    status: 'REJECTED',
    rejectionReason: normalizedReason,
    reviewedAt: new Date().toISOString(),
    reviewedByAdminId: adminId,
    stagingObjectKey: null,
    stagingFileId: null,
    pendingPublicObjectKey: null,
  })

  const rejected = await getAvatar(avatarId)

  if (
    rejected.status !== 'REJECTED' ||
    rejected.reviewedByAdminId !== adminId ||
    rejected.rejectionReason !== normalizedReason
  ) {
    throw new Error('Avatar rejection could not be completed.')
  }

  await recordModerationAction({
    adminId,
    action: 'CONTENT_REJECTED',
    targetType: 'AVATAR',
    targetId: avatar.id,
    reason: normalizedReason,
  })

  if (stagingKey) {
    await deleteOriginalObject(stagingKey)
  }
}
