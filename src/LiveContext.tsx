import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { AuthStatus, useAuth } from './AuthContext'
import { authApi, getAccessToken, getApiUrl } from './api'

export type LiveEventType =
  | 'post.created'
  | 'post.updated'
  | 'post.deleted'
  | 'post.approved'
  | 'post.rejected'
  | 'report.created'
  | 'report.updated'
  | 'comment.created'
  | 'comment.deleted'
  | 'notification.created'
  | 'profile.updated'
  | 'media.updated'
  | 'catalog.updated'

export interface LiveEvent<T = unknown> {
  id: string
  type: LiveEventType
  data: T
  createdAt: string
}

type LiveEventListener = (event: LiveEvent) => void

interface LiveContextValue {
  connected: boolean
  subscribe: (listener: LiveEventListener) => () => void
}

const LiveContext = createContext<LiveContextValue | null>(null)

const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 30000

export function LiveProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()

  const [connected, setConnected] = useState(false)

  const listeners = useRef(new Set<LiveEventListener>())

  const subscribe = useCallback((listener: LiveEventListener) => {
    listeners.current.add(listener)

    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (status !== AuthStatus.Authenticated || !user) {
      setConnected(false)
      return
    }

    const controller = new AbortController()
    const { signal } = controller

    let retryDelay = INITIAL_RETRY_DELAY

    async function connect() {
      while (!signal.aborted) {
        try {
          let token = getAccessToken()

          if (!token) {
            throw new Error('No access token available')
          }

          let response = await fetch(getApiUrl('/api/live/events'), {
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            signal,
          })

          if (response.status === 401) {
            await authApi.refresh()

            token = getAccessToken()

            if (!token) {
              throw new Error('Token refresh failed')
            }

            response = await fetch(getApiUrl('/api/live/events'), {
              headers: {
                Accept: 'text/event-stream',
                Authorization: `Bearer ${token}`,
              },
              credentials: 'include',
              signal,
            })
          }

          if (!response.ok || !response.body) {
            throw new Error(`Live connection failed (${response.status})`)
          }

          setConnected(true)
          retryDelay = INITIAL_RETRY_DELAY

          const reader = response.body.getReader()
          const decoder = new TextDecoder()

          let buffer = ''

          while (!signal.aborted) {
            const { done, value } = await reader.read()

            if (done) break

            buffer += decoder.decode(value, { stream: true })

            let boundary: number

            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
              const block = buffer.slice(0, boundary)
              buffer = buffer.slice(boundary + 2)

              processEvent(block)
            }
          }

          reader.releaseLock()

          if (!signal.aborted) {
            throw new Error('Live connection closed')
          }
        } catch (error) {
          setConnected(false)

          if (signal.aborted) break

          console.error('Live connection error:', error)

          if (
            error instanceof Error &&
            error.message === 'Token refresh failed'
          ) {
            break
          }

          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, retryDelay)

            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeout)
                resolve()
              },
              { once: true },
            )
          })

          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY)
        }
      }

      setConnected(false)
    }

    function processEvent(block: string) {
      let data = ''

      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) {
          data += line.slice(5).trimStart()
        }
      }

      if (!data) return

      try {
        const event = JSON.parse(data) as LiveEvent

        listeners.current.forEach((listener) => {
          listener(event)
        })
      } catch (error) {
        console.error('Invalid live event:', error)
      }
    }

    void connect()

    return () => {
      controller.abort()
      setConnected(false)
    }
  }, [status, user?.id])

  return (
    <LiveContext.Provider value={{ connected, subscribe }}>
      {children}
    </LiveContext.Provider>
  )
}

export function useLive(): LiveContextValue {
  const context = useContext(LiveContext)

  if (!context) {
    throw new Error('useLive must be used inside a LiveProvider')
  }

  return context
}
