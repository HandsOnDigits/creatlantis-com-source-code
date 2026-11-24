import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import { postsApi, profilesApi, type Post, type ProfileLayout } from '../../api'

interface UseSpotlightEditorParams {
  username: string | undefined
  identityId: string | undefined
  profileIdentityId: string | undefined
  layout: ProfileLayout | null
  setLayout: Dispatch<SetStateAction<ProfileLayout | null>>
}

export function useSpotlightEditor({
  username,
  identityId,
  profileIdentityId,
  layout,
  setLayout,
}: UseSpotlightEditorParams) {
  const [spotlightPosts, setSpotlightPosts] = useState<Post[]>([])
  const [editingSpotlightId, setEditingSpotlightId] = useState<string | null>(
    null,
  )
  const [spotlightTitle, setSpotlightTitle] = useState('')
  const [selectedSpotlightPosts, setSelectedSpotlightPosts] = useState<Post[]>(
    [],
  )
  const [spotlightSelectorOpen, setSpotlightSelectorOpen] = useState(false)
  const [savingSpotlight, setSavingSpotlight] = useState(false)
  const [spotlightError, setSpotlightError] = useState<string | null>(null)

  useEffect(() => {
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setSpotlightPosts([])
      return
    }

    let cancelled = false

    async function loadSpotlightPosts() {
      try {
        const response = await postsApi.listByUsername(username!, 1, 50)

        if (!cancelled) {
          setSpotlightPosts(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load Spotlight posts:', err)
          setSpotlightPosts([])
        }
      }
    }

    loadSpotlightPosts()

    return () => {
      cancelled = true
    }
  }, [username])

  function openSpotlightEditor(widgetId: string) {
    const widget = layout?.columns
      .flatMap((column) => column.widgets)
      .find((item) => item.id === widgetId && item.type === 'featured')

    if (!widget) {
      return
    }

    setSpotlightTitle(widget.config?.title ?? '')

    const postIds = widget.config?.postIds ?? []

    setSelectedSpotlightPosts(
      postIds
        .map((id) => spotlightPosts.find((post) => post.id === id))
        .filter((post): post is Post => post !== undefined),
    )

    setSpotlightError(null)
    setEditingSpotlightId(widgetId)
  }

  async function saveSpotlight() {
    if (
      !layout ||
      !editingSpotlightId ||
      identityId !== profileIdentityId ||
      savingSpotlight
    ) {
      return
    }

    const updatedLayout: ProfileLayout = {
      ...layout,
      columns: layout.columns.map((column) => ({
        ...column,
        widgets: column.widgets.map((widget) =>
          widget.id === editingSpotlightId && widget.type === 'featured'
            ? {
                ...widget,
                config: {
                  ...widget.config,
                  title: spotlightTitle,
                  postIds: selectedSpotlightPosts.map((post) => post.id),
                },
              }
            : widget,
        ),
      })),
    }

    try {
      setSavingSpotlight(true)
      setSpotlightError(null)

      const response = await profilesApi.updateMyLayout(updatedLayout)

      setLayout(response.data.layout)
      setEditingSpotlightId(null)
    } catch (err) {
      setSpotlightError(
        err instanceof Error ? err.message : 'Failed to save Spotlight.',
      )
    } finally {
      setSavingSpotlight(false)
    }
  }

  return {
    spotlightPosts,
    editingSpotlightId,
    setEditingSpotlightId,
    spotlightTitle,
    setSpotlightTitle,
    selectedSpotlightPosts,
    setSelectedSpotlightPosts,
    spotlightSelectorOpen,
    setSpotlightSelectorOpen,
    savingSpotlight,
    spotlightError,
    openSpotlightEditor,
    saveSpotlight,
  }
}
