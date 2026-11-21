import { Router } from 'express'
import { z } from 'zod'

import { db } from '../../prisma/db.js'
import { requireChatAuth } from '../auth/auth.middleware.js'
import {
  resolveChatRecipient,
  resolveChatRecipients,
} from '../internal/main-api.client.js'

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

    const otherParticipants = await Promise.all(
      memberships.map(async (membership) => {
        const participants = await db.orm.public.ConversationParticipant.where({
          conversationId: membership.conversationId,
        })
          .select('identityId')
          .all()

        return {
          conversationId: membership.conversationId,
          identityId: participants.find(
            (participant) => participant.identityId !== identityId,
          )?.identityId,
        }
      }),
    )

    const recipients = await resolveChatRecipients(
      otherParticipants.flatMap((participant) =>
        participant.identityId ? [participant.identityId] : [],
      ),
    )

    const conversationsWithRecipients = memberships.map((membership) => {
      const otherParticipant = otherParticipants.find(
        (participant) =>
          participant.conversationId === membership.conversationId,
      )

      const recipient = recipients.find(
        (recipient) => recipient.identityId === otherParticipant?.identityId,
      )

      return {
        ...membership,
        recipient: recipient ?? null,
      }
    })

    const conversations = await Promise.all(
      conversationsWithRecipients.map(async (membership) => {
        const query =
          membership.lastReadAt === null
            ? db.raw.sql`
                SELECT COUNT(*)::int AS "unreadCount"
                FROM "PrivateMessage"
                WHERE "conversationId" = ${membership.conversationId}
                  AND "senderIdentityId" IS DISTINCT FROM ${identityId}
                  AND "deletedAt" IS NULL
              `
                .returnsRow({
                  unreadCount: 'pg/int4@1',
                })
                .build()
            : db.raw.sql`
                SELECT COUNT(*)::int AS "unreadCount"
                FROM "PrivateMessage"
                WHERE "conversationId" = ${membership.conversationId}
                  AND "senderIdentityId" IS DISTINCT FROM ${identityId}
                  AND "deletedAt" IS NULL
                  AND "createdAt" > ${membership.lastReadAt}::timestamptz
              `
                .returnsRow({
                  unreadCount: 'pg/int4@1',
                })
                .build()

        const conversation = await db.orm.public.Conversation.where({
          id: membership.conversationId,
        })
          .select('lastMessageAt')
          .first()

        const lastMessage = await db.orm.public.PrivateMessage.where({
          conversationId: membership.conversationId,
          deletedAt: null,
        })
          .select('content', 'createdAt', 'senderIdentityId')
          .orderBy([
            (message) => message.createdAt.desc(),
            (message) => message.id.desc(),
          ])
          .first()

        const result = await db.query(query)

        return {
          ...membership,
          lastMessageAt: conversation?.lastMessageAt ?? null,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderIdentityId: lastMessage.senderIdentityId,
              }
            : null,
          unreadCount: result[0]?.unreadCount ?? 0,
        }
      }),
    )

    return res.json({
      conversations,
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

// POST /api/notes/conversations/:conversationId/messages
const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(10000),
})

notesRouter.post(
  '/conversations/:conversationId/messages',
  async (req, res) => {
    const conversationId = z
      .string()
      .uuid()
      .safeParse(req.params.conversationId)
    const parsed = sendMessageSchema.safeParse(req.body)

    if (!conversationId.success || !parsed.success) {
      return res.status(400).json({
        error: 'Invalid message data',
      })
    }

    const senderIdentityId = req.auth!.identityId

    try {
      const message = await db.transaction(async (tx) => {
        // Verify that the sender belongs to this conversation.
        const membership = await tx.orm.public.ConversationParticipant.where({
          conversationId: conversationId.data,
          identityId: senderIdentityId,
        })
          .select('conversationId')
          .first()

        if (!membership) {
          return null
        }

        // Create the message.
        const createdMessage = await tx.orm.public.PrivateMessage.create({
          conversationId: conversationId.data,
          senderIdentityId,
          content: parsed.data.content,
        })

        // Update the conversation's latest message timestamp.
        await tx.orm.public.Conversation.where({
          id: conversationId.data,
        }).update({
          lastMessageAt: createdMessage.createdAt,
        })

        return createdMessage
      })

      if (!message) {
        return res.status(404).json({
          error: 'Conversation not found',
        })
      }

      return res.status(201).json({
        message,
      })
    } catch (error) {
      console.error('Failed to send Notes message:', error)

      return res.status(500).json({
        error: 'Failed to send message',
      })
    }
  },
)

// GET /api/notes/conversations/:conversationId/messages
notesRouter.get('/conversations/:conversationId/messages', async (req, res) => {
  const conversationId = z.string().uuid().safeParse(req.params.conversationId)

  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(req.query.page ?? 1)

  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .safeParse(req.query.limit ?? 50)

  if (!conversationId.success || !page.success || !limit.success) {
    return res.status(400).json({
      error: 'Invalid conversation or pagination parameters',
    })
  }

  const identityId = req.auth!.identityId
  const pageSize = limit.data
  const offset = (page.data - 1) * pageSize

  try {
    // Verify conversation membership.
    const membership = await db.orm.public.ConversationParticipant.where({
      conversationId: conversationId.data,
      identityId,
    })
      .select('conversationId')
      .first()

    if (!membership) {
      return res.status(404).json({
        error: 'Conversation not found',
      })
    }

    // Fetch newest messages first for pagination.
    const messages = await db.orm.public.PrivateMessage.where({
      conversationId: conversationId.data,
    })
      .select(
        'id',
        'conversationId',
        'senderIdentityId',
        'content',
        'createdAt',
        'editedAt',
        'deletedAt',
      )
      .orderBy([
        (message) => message.createdAt.desc(),
        (message) => message.id.desc(),
      ])
      .limit(pageSize + 1)
      .offset(offset)
      .all()

    const hasMore = messages.length > pageSize

    // Return this page in chronological order.
    const pageMessages = messages.slice(0, pageSize).reverse()

    return res.json({
      messages: pageMessages,
      pagination: {
        page: page.data,
        limit: pageSize,
        hasMore,
      },
    })
  } catch (error) {
    console.error('Failed to load Notes messages:', error)

    return res.status(500).json({
      error: 'Failed to load messages',
    })
  }
})

// POST /api/notes/conversations/:conversationId/read
notesRouter.post('/conversations/:conversationId/read', async (req, res) => {
  const conversationId = z.string().uuid().safeParse(req.params.conversationId)

  if (!conversationId.success) {
    return res.status(400).json({
      error: 'Invalid conversation ID',
    })
  }

  const identityId = req.auth!.identityId
  const lastReadAt = new Date().toISOString()

  try {
    const updated = await db.transaction(async (tx) => {
      const membership = await tx.orm.public.ConversationParticipant.where({
        conversationId: conversationId.data,
        identityId,
      })
        .select('conversationId')
        .first()

      if (!membership) {
        return false
      }

      await tx.orm.public.ConversationParticipant.where({
        conversationId: conversationId.data,
        identityId,
      }).update({
        lastReadAt,
      })

      return true
    })

    if (!updated) {
      return res.status(404).json({
        error: 'Conversation not found',
      })
    }

    return res.json({
      conversationId: conversationId.data,
      lastReadAt,
    })
  } catch (error) {
    console.error('Failed to mark Notes conversation as read:', error)

    return res.status(500).json({
      error: 'Failed to mark conversation as read',
    })
  }
})
