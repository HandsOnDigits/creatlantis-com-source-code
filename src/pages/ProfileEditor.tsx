import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { CSS } from '@dnd-kit/utilities'

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

interface SortableWidgetProps {
  widgetId: string
  label: string
  onRemove: () => void
  children: React.ReactNode
}

function SortableWidget({
  widgetId,
  label,
  onRemove,
  children,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widgetId })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`bg-background-blend flex flex-col gap-3 rounded border border-current/20 p-3 ${
        isDragging ? 'z-10 opacity-30 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded px-1 text-xl opacity-50 select-none hover:bg-current/5 active:cursor-grabbing"
          aria-label={`Drag to reorder ${label}`}
          title="Drag to reorder or move"
        >
          ⠿
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-bold">{label}</p>
          <p className="truncate text-xs opacity-50">{widgetId}</p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
        >
          <img src={benIcon} className="navigation-icon" alt="" />
        </button>
      </div>

      {children}
    </div>
  )
}

interface DroppableColumnProps {
  columnId: string
  widgetIds: string[]
  children: React.ReactNode
}

function DroppableColumn({
  columnId,
  widgetIds,
  children,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${columnId}`,
  })

  return (
    <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
      <section
        ref={setNodeRef}
        className={`bg-background-blend flex min-h-64 flex-col gap-3 rounded border p-4 ${
          isOver ? 'border-current/60' : 'border-current/20'
        }`}
      >
        {children}
      </section>
    </SortableContext>
  )
}

const profileCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)

  const widgetCollisions = pointerCollisions.filter(
    ({ id }) => !String(id).startsWith('column:'),
  )

  if (widgetCollisions.length > 0) {
    return widgetCollisions
  }

  if (pointerCollisions.length > 0) {
    return pointerCollisions
  }

  return closestCenter(args)
}

function ProfileEditor() {
  const [layout, setLayout] = useState<ProfileLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingLayout, setSavingLayout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [layoutSuccess, setLayoutSuccess] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    setLayout((current) => {
      if (!current) return current

      const sourceColumn = current.columns.find((column) =>
        column.widgets.some((widget) => widget.id === activeId),
      )

      if (!sourceColumn) return current

      const sourceIndex = sourceColumn.widgets.findIndex(
        (widget) => widget.id === activeId,
      )

      const targetColumn = overId.startsWith('column:')
        ? current.columns.find(
            (column) => column.id === overId.slice('column:'.length),
          )
        : current.columns.find((column) =>
            column.widgets.some((widget) => widget.id === overId),
          )

      if (!targetColumn) return current

      const widget = sourceColumn.widgets[sourceIndex]

      const targetIndex = overId.startsWith('column:')
        ? targetColumn.widgets.length
        : targetColumn.widgets.findIndex((item) => item.id === overId)

      if (sourceColumn.id === targetColumn.id) {
        const destinationIndex =
          targetIndex === -1 ? targetColumn.widgets.length - 1 : targetIndex

        if (sourceIndex === destinationIndex) return current

        return {
          ...current,
          columns: current.columns.map((column) =>
            column.id === sourceColumn.id
              ? {
                  ...column,
                  widgets: arrayMove(
                    column.widgets,
                    sourceIndex,
                    destinationIndex,
                  ),
                }
              : column,
          ),
        }
      }

      const targetWidgets = [...targetColumn.widgets]
      targetWidgets.splice(
        targetIndex === -1 ? targetWidgets.length : targetIndex,
        0,
        widget,
      )

      return {
        ...current,
        columns: current.columns.map((column) => {
          if (column.id === sourceColumn.id) {
            return {
              ...column,
              widgets: column.widgets.filter((item) => item.id !== activeId),
            }
          }

          if (column.id === targetColumn.id) {
            return {
              ...column,
              widgets: targetWidgets,
            }
          }

          return column
        }),
      }
    })
  }

  function handleDragEnd() {
    setActiveDragId(null)
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

  const activeWidget = activeDragId
    ? layout.columns
        .flatMap((column) => column.widgets)
        .find((widget) => widget.id === activeDragId)
    : null

  const activeWidgetLabel = activeWidget
    ? (availableWidgets.find((item) => item.type === activeWidget.type)
        ?.label ?? activeWidget.type)
    : ''

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
        <DndContext
          sensors={sensors}
          collisionDetection={profileCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {layout.columns.map((column) => (
              <DroppableColumn
                key={column.id}
                columnId={column.id}
                widgetIds={column.widgets.map((widget) => widget.id)}
              >
                <h3 className="font-bold">
                  {column.id === 'main' ? 'Main column' : 'Sidebar'}
                </h3>

                {column.widgets.map((widget) => {
                  const label =
                    availableWidgets.find((item) => item.type === widget.type)
                      ?.label ?? widget.type

                  return (
                    <SortableWidget
                      key={widget.id}
                      widgetId={widget.id}
                      label={label}
                      onRemove={() => removeWidget(widget.id)}
                    >
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
                    </SortableWidget>
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
              </DroppableColumn>
            ))}
          </div>

          <DragOverlay>
            {activeWidget && (
              <div className="bg-background-blend rounded border border-current/40 p-4 opacity-95 shadow-xl">
                <p className="font-bold">{activeWidgetLabel}</p>
                <p className="mt-1 text-xs opacity-50">Moving widget</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>

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
