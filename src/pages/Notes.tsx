import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../AuthContext'
import {
  notesApi,
  type NotesConversationMembership,
  type NotesMessage,
} from '../api'
import NavTabs, { type NavTab, ProfileIcon, HorizontalHR } from '../Utilites'

function Notes() {
  const { user } = useAuth()

  const [conversations, setConversations] = useState<
    NotesConversationMembership[]
  >([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL')
  const [messages, setMessages] = useState<NotesMessage[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadConversations() {
      try {
        setLoading(true)
        setError(null)

        const response = await notesApi.listConversations()

        if (!cancelled) {
          setConversations(response.conversations)
          setSelectedConversationId(
            (current) =>
              current ?? response.conversations[0]?.conversationId ?? null,
          )
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load Notes conversations:', err)
          setError('Unable to load your conversations.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadConversations()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    let cancelled = false

    async function loadMessages() {
      try {
        setMessagesLoading(true)
        setError(null)

        const response = await notesApi.listMessages(selectedConversationId!)

        if (cancelled) return

        setMessages(response.messages)

        try {
          await notesApi.markRead(selectedConversationId!)
          setConversations((current) =>
            current.map((conversation) =>
              conversation.conversationId === selectedConversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            ),
          )
        } catch (readError) {
          console.error('Failed to mark conversation as read:', readError)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load conversation:', err)
          setError('Unable to load this conversation.')
        }
      } finally {
        if (!cancelled) setMessagesLoading(false)
      }
    }

    loadMessages()

    return () => {
      cancelled = true
    }
  }, [selectedConversationId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedContent = content.trim()

    if (!selectedConversationId || !trimmedContent || sending) return

    try {
      setSending(true)
      setError(null)

      const response = await notesApi.sendMessage(
        selectedConversationId,
        trimmedContent,
      )

      setMessages((current) => [...current, response.message])
      setContent('')

      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === selectedConversationId
            ? {
                ...conversation,
                lastMessage: {
                  content: response.message.content,
                  createdAt: response.message.createdAt,
                  senderIdentityId: response.message.senderIdentityId,
                },
                lastMessageAt: response.message.createdAt,
              }
            : conversation,
        ),
      )
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Unable to send your message.')
    } finally {
      setSending(false)
    }
  }

  const selectedConversation = conversations.find(
    (conversation) => conversation.conversationId === selectedConversationId,
  )

  const tabs: NavTab<'ALL' | 'UNREAD' | 'READ'>[] = [
    { id: 'ALL', label: 'All' },
    { id: 'UNREAD', label: 'Unread' },
    { id: 'READ', label: 'Read' },
  ]

  const filteredConversations = conversations.filter((conversation) => {
    if (activeTab === 'UNREAD') return conversation.unreadCount > 0
    if (activeTab === 'READ') return conversation.unreadCount === 0
    return true
  })

  return (
    <div className="flex min-h-screen">
      {/* Conversation Index */}
      <ol
        id="notes-index"
        className="`min-w-45 w-[24vw] max-w-[320px] space-y-2 overflow-y-auto p-4"
      >
        <h2 className="mb-4 font-bold">Notes</h2>

        <NavTabs<'ALL' | 'UNREAD' | 'READ'>
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="Filter conversations"
        />

        {loading && <li>Loading conversations...</li>}

        {!loading && conversations.length === 0 && (
          <li className="text-sm opacity-60">No conversations yet.</li>
        )}

        {filteredConversations.map((conversation) => (
          <li
            key={conversation.conversationId}
            onClick={() =>
              setSelectedConversationId(conversation.conversationId)
            }
            className={`cursor-pointer rounded-lg p-3 transition-colors ${
              selectedConversationId === conversation.conversationId
                ? 'selected-index'
                : 'hover:bg-black/5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <ProfileIcon
                image={conversation.recipient?.avatarUrl}
                name={
                  conversation.recipient?.name ||
                  conversation.recipient?.username ||
                  'Unknown user'
                }
              />

              {conversation.unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                  {conversation.unreadCount}
                </span>
              )}
            </div>

            <p className="mt-1 truncate text-sm opacity-70">
              {conversation.lastMessage?.content ?? 'No messages yet'}
            </p>

            {conversation.lastMessageAt && (
              <time className="mt-1 block text-xs opacity-50">
                {new Date(conversation.lastMessageAt).toLocaleDateString()}
              </time>
            )}
          </li>
        ))}
      </ol>

      {/* Conversation Context */}
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <h2 className="big-text font-bold">
          {selectedConversation?.recipient?.name ||
            selectedConversation?.recipient?.username ||
            'Conversation'}
        </h2>

        <HorizontalHR />

        {error && (
          <p role="alert" className="text-red-500">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
          {messagesLoading && <p>Loading messages...</p>}

          {!messagesLoading &&
            selectedConversationId &&
            messages.length === 0 && (
              <p className="opacity-60">
                No messages yet. Start the conversation below.
              </p>
            )}

          {!selectedConversationId && !loading && (
            <p className="opacity-60">Select a conversation from the index.</p>
          )}

          {messages.map((message) => {
            const ownMessage = message.senderIdentityId === user?.identityId

            return (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-lg border p-3 ${
                  ownMessage ? 'ml-auto' : 'mr-auto'
                }`}
              >
                <p className="mb-1 text-xs font-semibold opacity-70">
                  {ownMessage
                    ? user?.name || user?.username || 'You'
                    : selectedConversation?.recipient?.name ||
                      selectedConversation?.recipient?.username ||
                      'Unknown user'}
                </p>
                <p className="wrap-break-word whitespace-pre-wrap">
                  {message.deletedAt
                    ? 'This message was deleted.'
                    : message.content}
                </p>

                <time
                  className="mt-2 block text-xs opacity-50"
                  dateTime={message.createdAt}
                >
                  {new Date(message.createdAt).toLocaleString()}
                </time>
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-4">
          <input
            type="text"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a message..."
            maxLength={10000}
            disabled={!selectedConversationId || messagesLoading || sending}
            className="min-w-0 flex-1 rounded-lg border p-3"
          />

          <button
            type="submit"
            disabled={
              !selectedConversationId ||
              messagesLoading ||
              sending ||
              !content.trim()
            }
            className="rounded-lg border px-4"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Notes
