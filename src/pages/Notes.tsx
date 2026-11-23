import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../AuthContext'
import {
  notesApi,
  type NotesConversationMembership,
  type NotesMessage,
} from '../api'
import NavTabs, { type NavTab, ProfileIcon, HorizontalHR } from '../Utilites'

function Notes() {
  const { user } = useAuth()

  const [searchParams] = useSearchParams()
  const requestedConversationId = searchParams.get('conversationId')

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
          const requestedConversation = response.conversations.find(
            (conversation) =>
              conversation.conversationId === requestedConversationId,
          )

          setSelectedConversationId(
            (current) =>
              current ??
              requestedConversation?.conversationId ??
              response.conversations[0]?.conversationId ??
              null,
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
  }, [requestedConversationId])

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

  async function handleDeleteMessage(messageId: string) {
    if (!selectedConversationId) return

    try {
      setError(null)

      await notesApi.deleteMessage(selectedConversationId, messageId)

      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      )

      const remainingMessages = messages.filter(
        (message) => message.id !== messageId,
      )
      const latestMessage = remainingMessages.at(-1)

      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === selectedConversationId
            ? {
                ...conversation,
                lastMessage: latestMessage
                  ? {
                      content: latestMessage.content,
                      createdAt: latestMessage.createdAt,
                      senderIdentityId: latestMessage.senderIdentityId,
                    }
                  : null,
                lastMessageAt: latestMessage?.createdAt ?? null,
              }
            : conversation,
        ),
      )
    } catch (err) {
      console.error('Failed to delete message:', err)
      setError('Unable to delete your message.')
    }
  }

  async function handleEndConversation() {
    if (!selectedConversationId) return

    const confirmed = window.confirm(
      'End this conversation permanently? All messages from both participants will be deleted. This cannot be undone.',
    )

    if (!confirmed) return

    try {
      setError(null)

      await notesApi.endConversation(selectedConversationId)

      const remainingConversations = conversations.filter(
        (conversation) =>
          conversation.conversationId !== selectedConversationId,
      )

      setConversations(remainingConversations)
      setSelectedConversationId(
        remainingConversations[0]?.conversationId ?? null,
      )
      setMessages([])
    } catch (err) {
      console.error('Failed to end conversation:', err)
      setError('Unable to end this conversation.')
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
    <>
      <div className="p-4">
        <h1 className="extra-big-text">Notes</h1>

        <HorizontalHR />
      </div>

      <div className="flex grow">
        <div>
          <NavTabs<'ALL' | 'UNREAD' | 'READ'>
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Filter conversations"
          />

          <div className="light-to-dark-gradient h-8"></div>

          {/* Conversation Index */}
          <ol
            id="notes-index"
            className="bg-background-blend h-[85vh] w-[24vw] max-w-[320px] min-w-45 overflow-y-scroll p-4"
          >
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
                className={`flex w-full cursor-pointer flex-col gap-2 p-3 transition-colors ${
                  selectedConversationId === conversation.conversationId
                    ? 'bg-background-blend'
                    : 'hover:bg-background-blend'
                }`}
              >
                {
                  /*conversation.unreadCount > 0 &&*/ <var className="size-min self-end rounded-full bg-blue-600 p-2 text-xs text-white">
                    {conversation.unreadCount}
                  </var>
                }

                {/* Small lookup at last message */}

                <ProfileIcon
                  image={conversation.recipient?.avatarUrl}
                  name={
                    conversation.recipient?.name ||
                    conversation.recipient?.username ||
                    'Unknown user'
                  }
                />

                <p
                  className={`truncate ${
                    selectedConversationId === conversation.conversationId
                      ? 'selected-index'
                      : ''
                  }`}
                >
                  {conversation.lastMessage?.content ?? 'No messages yet'}
                </p>

                {conversation.lastMessageAt && (
                  <time>
                    {new Date(conversation.lastMessageAt).toLocaleDateString()}
                  </time>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* Conversation Context */}
        <div className="flex flex-1 flex-col p-6">
          <h2 className="big-text font-bold">
            {selectedConversation?.recipient?.name ||
              selectedConversation?.recipient?.username ||
              'Conversation'}
          </h2>

          <HorizontalHR />

          <div className="bg-background-blend">
            {selectedConversation?.startedByIdentityId === user?.identityId && (
              <button type="button" onClick={handleEndConversation} id="end">
                End conversation
              </button>
            )}

            {error && (
              <p role="alert" className="text-red-500">
                {error}
              </p>
            )}

            <div className="flex flex-col overflow-y-scroll py-4">
              {messagesLoading && <p>Loading messages...</p>}

              {!messagesLoading &&
                selectedConversationId &&
                messages.length === 0 && (
                  <p className="opacity-60">
                    No messages yet. Start the conversation below.
                  </p>
                )}

              {!selectedConversationId && !loading && (
                <p className="opacity-60">
                  Select a conversation from the index.
                </p>
              )}

              {/* Message/Reply body */}
              {messages.map((message) => {
                const ownMessage = message.senderIdentityId === user?.identityId

                return (
                  <div
                    key={message.id}
                    className="border-hr-line flex w-full flex-col gap-4 border-x-4 p-3"
                  >
                    <ProfileIcon
                      image={
                        ownMessage
                          ? user?.avatarUrl
                          : selectedConversation?.recipient?.avatarUrl
                      }
                      name={
                        ownMessage
                          ? user?.name || user?.username || 'You'
                          : selectedConversation?.recipient?.name ||
                            selectedConversation?.recipient?.username ||
                            'Unknown user'
                      }
                    />

                    <p className="wrap-break-word whitespace-pre-wrap">
                      {message.content}
                    </p>

                    <time
                      className="block opacity-50"
                      dateTime={message.createdAt}
                    >
                      {new Date(message.createdAt).toLocaleString()}
                    </time>

                    {ownMessage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(message.id)}
                        className="delete self-end"
                      >
                        Delete
                      </button>
                    )}

                    <HorizontalHR />
                  </div>
                )
              })}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-4 flex items-center gap-2"
          >
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write a message..."
              maxLength={10000}
              disabled={!selectedConversationId || messagesLoading || sending}
              className="borde-hr-line w-full rounded-lg border-2 p-3"
            />

            <button
              type="submit"
              disabled={
                !selectedConversationId ||
                messagesLoading ||
                sending ||
                !content.trim()
              }
              className="submit"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default Notes
