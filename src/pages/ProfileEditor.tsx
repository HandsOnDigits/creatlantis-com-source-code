import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { profilesApi, type ProfileLayout, type ProfileWidget } from '../api'

import { HorizontalHR } from '../Utilites'

// Images
import benIcon from '../assets/images/icons/benIcon.webp'

const availableWidgets: {
  type: ProfileWidget['type']
  label: string
}[] = [
  { type: 'header', label: 'Header' },
  { type: 'bio', label: 'BIO' },
  { type: 'gallery', label: 'Gallery' },
  { type: 'journal', label: 'Journal' },
  { type: 'statistics', label: 'Statistics' },
  { type: 'featured', label: 'Spotlight' },
  { type: 'customText', label: 'Custom text' },
  { type: 'links', label: 'Links' },
  { type: 'friends', label: 'Friends' },
]

function ProfileEditor() {
  const [layout, setLayout] = useState<ProfileLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingLayout, setSavingLayout] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [layoutSuccess, setLayoutSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadEditor() {
      try {
        setLoading(true)
        setError(null)

        const layoutResponse = await profilesApi.getMyLayout()

        if (!cancelled) {
          setLayout(layoutResponse.data.layout)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load profile editor.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadEditor()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveLayout() {
    if (!layout) return

    try {
      setSavingLayout(true)
      setError(null)
      setLayoutSuccess(false)

      const response = await profilesApi.updateMyLayout(layout)

      setLayout(response.data.layout)
      setLayoutSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save profile layout.',
      )
    } finally {
      setSavingLayout(false)
    }
  }

  function addWidget(type: ProfileWidget['type']) {
    setLayout((current) => {
      if (!current) return current

      // Only one BIO widget is needed because the description
      // belongs to the profile itself.
      if (
        type === 'bio' &&
        current.columns.some((column) =>
          column.widgets.some((widget) => widget.type === 'bio'),
        )
      ) {
        return current
      }

      const newWidget: ProfileWidget = {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        ...(type === 'featured'
          ? {
              config: {
                title: 'Spotlight',
                content: '',
              },
            }
          : type === 'customText'
            ? {
                config: {
                  content:
                    '<div style="background: rgba(200, 200, 200, 0.6); padding: 20px; border-radius: 8px;"><h2>Welcome to my space!</h2><p>Tell visitors a little about yourself, your interests, your creative work, or anything you would like to share.</p></div>',
                },
              }
            : {}),
      }

      return {
        ...current,
        columns: current.columns.map((column) =>
          column.id === 'main'
            ? {
                ...column,
                widgets: [...column.widgets, newWidget],
              }
            : column,
        ),
      }
    })

    setLayoutSuccess(false)
  }

  function removeWidget(widgetId: string) {
    setLayout((current) => {
      if (!current) return current

      return {
        ...current,
        columns: current.columns.map((column) => ({
          ...column,
          widgets: column.widgets.filter((widget) => widget.id !== widgetId),
        })),
      }
    })

    setLayoutSuccess(false)
  }

  function updateWidgetConfig(
    widgetId: string,
    field: 'title' | 'content',
    value: string,
  ) {
    setLayout((current) => {
      if (!current) return current

      return {
        ...current,
        columns: current.columns.map((column) => ({
          ...column,
          widgets: column.widgets.map((widget) =>
            widget.id === widgetId
              ? {
                  ...widget,
                  config: {
                    ...widget.config,
                    [field]: value,
                  },
                }
              : widget,
          ),
        })),
      }
    })

    setLayoutSuccess(false)
  }

  function moveWidget(
    widgetId: string,
    targetColumnId: 'main' | 'sidebar',
    targetWidgetId?: string,
  ) {
    setLayout((current) => {
      if (!current) return current
      if (widgetId === targetWidgetId) return current

      const sourceColumn = current.columns.find((column) =>
        column.widgets.some((widget) => widget.id === widgetId),
      )

      if (!sourceColumn) return current

      const widget = sourceColumn.widgets.find((item) => item.id === widgetId)

      if (!widget) return current

      const columnsWithoutWidget = current.columns.map((column) => ({
        ...column,
        widgets: column.widgets.filter((item) => item.id !== widgetId),
      }))

      const targetColumn = columnsWithoutWidget.find(
        (column) => column.id === targetColumnId,
      )

      if (!targetColumn) return current

      const targetIndex = targetWidgetId
        ? targetColumn.widgets.findIndex((item) => item.id === targetWidgetId)
        : -1

      const widgets = [...targetColumn.widgets]

      if (targetIndex === -1) {
        widgets.push(widget)
      } else {
        widgets.splice(targetIndex, 0, widget)
      }

      return {
        ...current,
        columns: columnsWithoutWidget.map((column) =>
          column.id === targetColumnId ? { ...column, widgets } : column,
        ),
      }
    })

    setLayoutSuccess(false)
  }

  if (loading) {
    return <main className="p-8">Loading profile editor...</main>
  }

  if (!layout) {
    return (
      <main className="p-8">
        <p role="alert" className="error-feedback">
          {error ?? 'Could not load profile layout.'}
        </p>
        <Link to="/" className="mt-4 inline-block underline">
          Back
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 p-6">
      <header>
        <h1 className="big-text font-bold">Profile Editor</h1>
        <p className="mt-2 opacity-60">Customize your CreAtlantis profile.</p>
        <HorizontalHR />
      </header>

      {/* Widget builder */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">Profile layout</h2>

          <HorizontalHR />

          <p className="mt-1 text-sm opacity-60">
            Add widgets and drag them between columns to arrange your profile.
          </p>
        </div>

        {/* Available widgets */}
        <div className="bg-background-blend rounded border border-current/20 p-4">
          <h3 className="mb-3 font-bold">Add widgets</h3>

          <div className="flex flex-wrap gap-2">
            {availableWidgets.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addWidget(item.type)}
                disabled={
                  item.type === 'bio' &&
                  layout.columns.some((column) =>
                    column.widgets.some((widget) => widget.type === 'bio'),
                  )
                }
                className="bg-background-blend rounded border border-current/30 px-3 py-2 text-sm transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-30"
              >
                + {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Layout columns */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {layout.columns.map((column) => (
            <section
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()

                const widgetId = event.dataTransfer.getData('text/plain')

                if (widgetId) {
                  moveWidget(widgetId, column.id)
                }

                setDraggingId(null)
              }}
              className="bg-background-blend flex min-h-64 flex-col gap-3 rounded border border-current/20 p-4"
            >
              <h3 className="font-bold">
                {column.id === 'main' ? 'Main column' : 'Sidebar'}
              </h3>

              {column.widgets.map((widget) => {
                const label =
                  availableWidgets.find((item) => item.type === widget.type)
                    ?.label ?? widget.type

                return (
                  <div
                    key={widget.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', widget.id)
                      event.dataTransfer.effectAllowed = 'move'
                      setDraggingId(widget.id)
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      event.stopPropagation()

                      const draggedId = event.dataTransfer.getData('text/plain')

                      if (draggedId) {
                        moveWidget(draggedId, column.id, widget.id)
                      }

                      setDraggingId(null)
                    }}
                    className={`flex flex-col gap-3 rounded border border-current/20 p-3 ${
                      draggingId === widget.id ? 'opacity-30' : 'opacity-100'
                    } bg-background-blend`}
                  >
                    <div className="flex cursor-grab items-center gap-3 active:cursor-grabbing">
                      <span className="opacity-50 select-none">⠿</span>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{label}</p>
                        <p className="truncate text-xs opacity-50">
                          {widget.id}
                        </p>
                      </div>

                      <button
                        type="button"
                        draggable={false}
                        onClick={() => removeWidget(widget.id)}
                        aria-label={`Remove ${label}`}
                        title={`Remove ${label}`}
                      >
                        <img src={benIcon} className="navigation-icon" />
                      </button>
                    </div>

                    {(widget.type === 'featured' ||
                      widget.type === 'customText') && (
                      <div className="flex flex-col gap-3 border-t border-current/20 pt-3">
                        {widget.type === 'featured' && (
                          <label className="flex flex-col gap-1 text-sm">
                            Spotlight title
                            <input
                              type="text"
                              value={widget.config?.title ?? ''}
                              onChange={(event) =>
                                updateWidgetConfig(
                                  widget.id,
                                  'title',
                                  event.target.value,
                                )
                              }
                              maxLength={160}
                              className="bg-background-blend rounded border border-current/30 p-2"
                              placeholder="Enter a title..."
                            />
                          </label>
                        )}

                        <label className="flex flex-col gap-1 text-sm">
                          {widget.type === 'featured'
                            ? 'Spotlight content'
                            : 'Custom text content'}
                          <textarea
                            value={widget.config?.content ?? ''}
                            onChange={(event) =>
                              updateWidgetConfig(
                                widget.id,
                                'content',
                                event.target.value,
                              )
                            }
                            maxLength={20000}
                            rows={5}
                            className="bg-background-blend rounded border border-current/30 p-2"
                            placeholder="Write your content..."
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}

              {column.widgets.length === 0 && (
                <p className="rounded border border-dashed border-current/30 p-6 text-center text-sm opacity-50">
                  Drop widgets here
                </p>
              )}

              <p className="mt-auto text-xs opacity-40">
                Drag widgets to reorder or move them here.
              </p>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={saveLayout}
            disabled={savingLayout}
            className="save"
          >
            {savingLayout ? 'Saving layout...' : 'Save layout'}
          </button>

          <Link to="/">
            <button className="cancel">Cancel</button>
          </Link>

          {layoutSuccess && (
            <p role="status" className="text-green-500">
              Profile layout saved.
            </p>
          )}
        </div>
      </section>

      <hr className="border-current/20" />

      {error && (
        <p role="alert" className="error-feedback">
          {error}
        </p>
      )}
    </main>
  )
}

export default ProfileEditor
