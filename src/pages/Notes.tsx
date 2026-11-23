import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../AuthContext'
import {
  notesApi,
  type NotesConversationMembership,
  type NotesMessage,
} from '../api'
import NavTabs, { type NavTab, ProfileIcon, HorizontalHR } from '../Utilites'

// Icons
import editIcon from '../assets/images/icons/editIcon.webp'
import benIcon from '../assets/images/icons/benIcon.webp'

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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Confirmation states (replaces window.confirm)
  const [confirmingDeleteMessageId, setConfirmingDeleteMessageId] = useState<
    string | null
  >(null)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  )
  const [confirmingEndConversation, setConfirmingEndConversation] =
    useState(false)
  const [endingConversation, setEndingConversation] = useState(false)

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
    // Reset pending confirmations when switching conversations
    setConfirmingDeleteMessageId(null)
    setConfirmingEndConversation(false)

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

  async function handleSaveEdit(messageId: string) {
    if (!selectedConversationId || savingEdit) return

    const trimmedContent = editContent.trim()

    if (!trimmedContent) {
      setError('A message cannot be empty.')
      return
    }

    try {
      setSavingEdit(true)
      setError(null)

      await notesApi.editMessage(
        selectedConversationId,
        messageId,
        trimmedContent,
      )

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: trimmedContent,
                editedAt: new Date().toISOString(),
              }
            : message,
        ),
      )

      setEditingMessageId(null)
      setEditContent('')
    } catch (err) {
      console.error('Failed to edit message:', err)
      setError('Unable to edit your message.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleConfirmDeleteMessage(messageId: string) {
    if (!selectedConversationId || deletingMessageId) return

    try {
      setDeletingMessageId(messageId)
      setError(null)

      await notesApi.deleteMessage(selectedConversationId, messageId)

      const remainingMessages = messages.filter(
        (message) => message.id !== messageId,
      )
      const latestMessage = remainingMessages.at(-1)

      setMessages(remainingMessages)
      setConfirmingDeleteMessageId(null)

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
    } finally {
      setDeletingMessageId(null)
    }
  }

  async function handleConfirmEndConversation() {
    if (!selectedConversationId || endingConversation) return

    try {
      setEndingConversation(true)
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
      setConfirmingEndConversation(false)
    } catch (err) {
      console.error('Failed to end conversation:', err)
      setError('Unable to end this conversation.')
    } finally {
      setEndingConversation(false)
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
    <div className="flex flex-col">
      <div className="p-4 pb-0">
        <h1 className="extra-big-text">Notes</h1>

        <HorizontalHR />
      </div>

      {/* Responsive split: stacked on mobile, side-by-side on md+ */}
      <div className="flex flex-col max-sm:flex-col md:h-[80vh] md:flex-row">
        {/* Sidebar / Conversation Index */}
        <aside className="flex min-h-70 w-full flex-col max-sm:w-full md:w-72 lg:w-80">
          <NavTabs<'ALL' | 'UNREAD' | 'READ'>
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Filter conversations"
          />

          <div className="light-to-dark-gradient h-8" />

          <ol
            id="notes-index"
            className="bg-background-blend flex flex-1 flex-row gap-2 overflow-x-auto p-3 max-sm:flex-row md:flex-col md:overflow-x-hidden md:overflow-y-auto"
          >
            {loading && (
              <li className="p-2 text-sm opacity-60">
                Loading conversations...
              </li>
            )}

            {!loading && conversations.length === 0 && (
              <li className="p-2 text-sm opacity-60">No conversations yet.</li>
            )}

            {!loading &&
              conversations.length > 0 &&
              filteredConversations.length === 0 && (
                <li className="p-2 text-sm opacity-60">
                  No {activeTab.toLowerCase()} conversations.
                </li>
              )}

            {filteredConversations.map((conversation) => {
              const isSelected =
                selectedConversationId === conversation.conversationId

              return (
                <li
                  key={conversation.conversationId}
                  onClick={() =>
                    setSelectedConversationId(conversation.conversationId)
                  }
                  className={`flex w-60 cursor-pointer flex-col gap-1.5 p-3 transition-colors md:w-full ${
                    isSelected
                      ? 'bg-background-blend ring-1 ring-current/20'
                      : 'hover:bg-background-blend/70'
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
                      <span
                        aria-label={`${conversation.unreadCount} unread`}
                        className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white"
                      >
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>

                  <p
                    className={`truncate text-sm ${
                      isSelected ? 'selected-index font-semibold' : 'opacity-80'
                    }`}
                  >
                    {conversation.lastMessage?.content ?? 'No messages yet'}
                  </p>

                  {conversation.lastMessageAt && (
                    <time className="text-xs opacity-50">
                      {new Date(
                        conversation.lastMessageAt,
                      ).toLocaleDateString()}
                    </time>
                  )}
                </li>
              )
            })}
          </ol>
        </aside>

        {/* Active Conversation Thread */}
        <section className="flex flex-1 flex-col p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="big-text truncate font-bold">
              {selectedConversation?.recipient?.name ||
                selectedConversation?.recipient?.username ||
                'Conversation'}
            </h2>

            {selectedConversation?.startedByIdentityId === user?.identityId &&
              !confirmingEndConversation && (
                <button
                  type="button"
                  onClick={() => setConfirmingEndConversation(true)}
                  className="end"
                >
                  End conversation
                </button>
              )}
          </div>

          {confirmingEndConversation && (
            <div
              role="alertdialog"
              aria-labelledby="end-conversation-title"
              className=""
            >
              <p id="end-conversation-title">
                End this conversation permanently? All messages from both
                participants will be deleted.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingEndConversation(false)}
                  disabled={endingConversation}
                  className="cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndConversation}
                  disabled={endingConversation}
                  className="end"
                >
                  {endingConversation ? 'Ending...' : 'Yes, end conversation'}
                </button>
              </div>
            </div>
          )}

          <HorizontalHR />

          {error && (
            <p role="alert" id="error-feedback">
              {error}
            </p>
          )}

          {/* Message Feed */}
          <div className="bg-background-blend border-hr-line flex h-[50vh] flex-col overflow-y-auto border-l-4 px-4 py-2">
            {messagesLoading && (
              <p className="py-4 text-sm opacity-60">Loading messages...</p>
            )}

            {!messagesLoading &&
              selectedConversationId &&
              messages.length === 0 && (
                <p className="py-4 text-sm opacity-60">
                  No messages yet. Start the conversation below.
                </p>
              )}

            {!selectedConversationId && !loading && (
              <p className="py-4 text-sm opacity-60">
                Select a conversation from the index.
              </p>
            )}

            {messages.map((message) => {
              const ownMessage = message.senderIdentityId === user?.identityId
              const isConfirmingDelete =
                confirmingDeleteMessageId === message.id
              const isEditing = editingMessageId === message.id
              const isDeleting = deletingMessageId === message.id

              return (
                <div
                  key={message.id}
                  className="flex w-full flex-col gap-2 pt-4"
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

                  <time className="opacity-80" dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString()}
                  </time>

                  {editingMessageId === message.id ? (
                    <textarea
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      rows={3}
                      maxLength={10000}
                      disabled={savingEdit}
                      className="border-hr-line w-full resize-y rounded-lg border-2 p-3"
                    />
                  ) : (
                    <p className="wrap-break-word whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}

                  {message.editedAt && (
                    <span className="text-xs opacity-50">Edited</span>
                  )}

                  {ownMessage && (
                    <div className="flex items-center self-end">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null)
                              setEditContent('')
                            }}
                            disabled={savingEdit}
                            className="cancel"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(message.id)}
                            disabled={savingEdit || !editContent.trim()}
                            className="submit"
                          >
                            {savingEdit ? 'Saving...' : 'Save'}
                          </button>
                        </>
                      ) : isConfirmingDelete ? (
                        <>
                          <span>Are you sure?</span>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteMessageId(null)}
                            disabled={isDeleting}
                            className="cancel"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleConfirmDeleteMessage(message.id)
                            }
                            disabled={isDeleting}
                            className="delete"
                          >
                            {isDeleting ? 'Deleting...' : 'Yes, delete'}
                          </button>
                        </>
                      ) : (
                        <>
                          <img
                            src={editIcon}
                            onClick={() => {
                              setEditingMessageId(message.id)
                              setEditContent(message.content)
                              setConfirmingDeleteMessageId(null)
                            }}

                            title="Edit"
                            className="cursor-pointer"
                          />
                          <img
                            src={benIcon}
                            onClick={() =>
                              setConfirmingDeleteMessageId(message.id)
                            }
                            title="Delete"
                            className="cursor-pointer"
                          />
                        </>
                      )}
                    </div>
                  )}

                  <HorizontalHR />
                </div>
              )
            })}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-row gap-3 max-sm:mt-0"
          >
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write a message..."
              rows={2}
              maxLength={10000}
              disabled={!selectedConversationId || messagesLoading || sending}
              className="min-h-12 w-full resize-y p-3 disabled:opacity-50 max-sm:max-h-6 max-sm:p-1.5"
            />

            <button
              type="submit"
              disabled={
                !selectedConversationId ||
                messagesLoading ||
                sending ||
                !content.trim()
              }
              className="submit rounded-lg px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default Notes
