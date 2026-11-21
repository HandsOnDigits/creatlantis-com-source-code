import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { profilesApi, type ProfileLayout, type ProfileWidget } from '../api'

import { HorizontalHR } from '../Utilites'

const availableWidgets: {
  type: ProfileWidget['type']
  label: string
}[] = [
  { type: 'header', label: 'Header' },
  { type: 'bio', label: 'BIO' },
  { type: 'gallery', label: 'Gallery' },
  { type: 'journal', label: 'Journal' },
  { type: 'statistics', label: 'Statistics' },
  { type: 'featured', label: 'Featured' },
  { type: 'customText', label: 'Custom text' },
  { type: 'links', label: 'Links' },
  { type: 'friends', label: 'Friends' },
]

function ProfileEditor() {
  const [description, setDescription] = useState('')
  const [customCss, setCustomCss] = useState('')
  const [layout, setLayout] = useState<ProfileLayout | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [layoutSuccess, setLayoutSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadEditor() {
      try {
        setLoading(true)
        setError(null)

        const [customizationResponse, layoutResponse] = await Promise.all([
          profilesApi.getMyCustomization(),
          profilesApi.getMyLayout(),
        ])

        if (!cancelled) {
          setDescription(customizationResponse.data.description)
          setCustomCss(customizationResponse.data.customCss)
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

  async function saveCustomization() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await profilesApi.updateMyCustomization({
        description,
        customCss,
      })

      setDescription(response.data.description)
      setCustomCss(response.data.customCss)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save profile customization.',
      )
    } finally {
      setSaving(false)
    }
  }

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
        <p role="alert" className="text-red-500">
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
                        className="delete"
                        aria-label={`Remove ${label}`}
                      >
                        Delete
                      </button>
                    </div>

                    {/* BIO configuration */}
                    {widget.type === 'bio' && (
                      <div
                        className="flex flex-col gap-3 border-t border-current/20 pt-3"
                        draggable={false}
                      >
                        <div>
                          <h4 className="font-bold">BIO content</h4>
                          <p className="mt-1 text-xs opacity-60">
                            Write your profile biography using BBCode, Markdown,
                            or HTML. HTML is sanitized before display.
                          </p>
                        </div>

                        <label
                          htmlFor="profile-bio"
                          className="text-sm font-bold"
                        >
                          Biography content
                        </label>

                        <textarea
                          id="profile-bio"
                          draggable={false}
                          value={description}
                          onChange={(event) => {
                            setDescription(event.target.value)
                            setSuccess(false)
                          }}
                          maxLength={20_000}
                          rows={10}
                          className="w-full resize-y rounded border border-current/20 bg-transparent p-3 font-mono text-sm"
                          placeholder="[b]Welcome to my profile![/b]"
                        />

                        <p className="text-xs opacity-50">
                          {description.length.toLocaleString()} / 20,000
                          characters
                        </p>
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

          <Link to="/" className="underline opacity-70 hover:opacity-100">
            Cancel
          </Link>

          {layoutSuccess && (
            <p role="status" className="text-green-500">
              Profile layout saved.
            </p>
          )}
        </div>
      </section>

      <hr className="border-current/20" />

      {/* Custom CSS editor */}
      <section className="bg-background-blend flex flex-col gap-3">
        <h2 className="text-xl font-bold">Custom CSS</h2>

        <HorizontalHR />

        <label htmlFor="profile-css" className="font-bold">
          Profile styles
        </label>

        <textarea
          id="profile-css"
          value={customCss}
          onChange={(event) => {
            setCustomCss(event.target.value)
            setSuccess(false)
          }}
          maxLength={50_000}
          rows={14}
          className="w-full resize-y rounded border border-current/20 bg-transparent p-4 font-mono text-sm"
          placeholder="/* Your profile styles */"
        />

        <p className="text-xs opacity-50">
          {customCss.length.toLocaleString()} / 50,000 characters
        </p>
      </section>

      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-green-500">
          Profile profile and CSS saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveCustomization}
          disabled={saving}
          className="save"
        >
          {saving ? 'Saving...' : 'Save CSS'}
        </button>

        <Link to="/" className="underline opacity-70 hover:opacity-100">
          Cancel
        </Link>
      </div>
    </main>
  )
}

export default ProfileEditor
