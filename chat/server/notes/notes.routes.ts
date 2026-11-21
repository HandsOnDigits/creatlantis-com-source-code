import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../prisma/db.js'
import { requireChatAuth } from '../auth/auth.middleware.js'
import { resolveChatRecipient } from '../internal/main-api.client.js'

export const notesRouter = Router()

notesRouter.use(requireChatAuth)

const createConversationSchema = z.object({
  recipientIdentityId: z.string().uuid(),
})

// GET /api/notes/conversations
notesRouter.get('/conversations', async (req, res) => {
  const identityId = req.auth!.identityId

  try {
    const memberships = await db.orm.public.ConversationParticipant.where({
      identityId,
      archivedAt: null,
    })
      .select('conversationId', 'lastReadAt', 'mutedAt')
      .all()

    return res.json({
      conversations: memberships,
    })
  } catch (error) {
    console.error('Failed to load Notes conversations:', error)

    return res.status(500).json({
      error: 'Failed to load conversations',
    })
  }
})

// POST /api/notes/conversations
notesRouter.post('/conversations', async (req, res) => {
  const parsed = createConversationSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid conversation data',
    })
  }

  const senderIdentityId = req.auth!.identityId
  const recipientIdentityId = parsed.data.recipientIdentityId

  if (senderIdentityId === recipientIdentityId) {
    return res.status(400).json({
      error: 'You cannot start a conversation with yourself',
    })
  }

  try {
    const recipient = await resolveChatRecipient(recipientIdentityId)

    if (!recipient) {
      return res.status(404).json({
        error: 'Recipient not found',
      })
    }

    const directKey = [senderIdentityId, recipientIdentityId].sort().join(':')

    const result = await db.transaction(async (tx) => {
      const existing = await tx.orm.public.Conversation.where({
        directKey,
      })
        .select('id')
        .first()

      if (existing) {
        return {
          conversationId: existing.id,
          created: false,
        }
      }

      const conversation = await tx.orm.public.Conversation.create({
        directKey,
      })

      await tx.orm.public.ConversationParticipant.create({
        conversationId: conversation.id,
        identityId: senderIdentityId,
      })

      await tx.orm.public.ConversationParticipant.create({
        conversationId: conversation.id,
        identityId: recipientIdentityId,
      })

      return {
        conversationId: conversation.id,
        created: true,
      }
    })

    return res.status(result.created ? 201 : 200).json({
      conversationId: result.conversationId,
      created: result.created,
      recipient,
    })
  } catch (error) {
    // Another request may have created the same direct conversation
    // concurrently. Reuse it if it now exists.
    try {
      const directKey = [senderIdentityId, recipientIdentityId].sort().join(':')

      const existing = await db.orm.public.Conversation.where({
        directKey,
      })
        .select('id')
        .first()

      if (existing) {
        return res.status(200).json({
          conversationId: existing.id,
          created: false,
        })
      }
    } catch {
      // Fall through to the original error.
    }

    console.error('Failed to create Notes conversation:', error)

    return res.status(500).json({
      error: 'Failed to create conversation',
    })
  }
})
