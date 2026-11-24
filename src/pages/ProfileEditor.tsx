import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
  type CollisionDetection,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

import {
  SortableContext,
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

function getWidgetLabel(type: ProfileWidget['type']) {
  return availableWidgets.find((widget) => widget.type === type)?.label ?? type
}

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

function getTargetColumn(layout: ProfileLayout, targetId: string) {
  if (targetId.startsWith('column:')) {
    const columnId = targetId.slice('column:'.length)
    return layout.columns.find(({ id }) => id === columnId)
  }

  return layout.columns.find(({ widgets }) =>
    widgets.some(({ id }) => id === targetId),
  )
}

function getWidgetInsertIndex(
  targetWidgets: ProfileWidget[],
  targetId: string,
  insertAfter: boolean,
) {
  if (targetId.startsWith('column:')) {
    return targetWidgets.length
  }

  const targetIndex = targetWidgets.findIndex(({ id }) => id === targetId)

  if (targetIndex === -1) return -1

  return targetIndex + (insertAfter ? 1 : 0)
}

function moveWidget(
  layout: ProfileLayout,
  activeId: string,
  targetId: string,
  insertAfter: boolean,
): ProfileLayout {
  const sourceColumn = layout.columns.find(({ widgets }) =>
    widgets.some(({ id }) => id === activeId),
  )

  const targetColumn = getTargetColumn(layout, targetId)

  if (!sourceColumn || !targetColumn) return layout

  const sourceIndex = sourceColumn.widgets.findIndex(
    ({ id }) => id === activeId,
  )

  const widget = sourceColumn.widgets[sourceIndex]

  if (!widget) return layout

  if (sourceColumn.id === targetColumn.id) {
    if (targetId.startsWith('column:')) return layout

    const targetIndex = sourceColumn.widgets.findIndex(
      ({ id }) => id === targetId,
    )

    if (targetIndex === -1) return layout

    const widgets = [...sourceColumn.widgets]
    widgets.splice(sourceIndex, 1)

    let insertIndex = targetIndex + (insertAfter ? 1 : 0)

    if (sourceIndex < insertIndex) {
      insertIndex--
    }

    widgets.splice(insertIndex, 0, widget)

    return {
      ...layout,
      columns: layout.columns.map((column) =>
        column.id === sourceColumn.id ? { ...column, widgets } : column,
      ),
    }
  }

  const targetWidgets = [...targetColumn.widgets]
  const insertIndex = getWidgetInsertIndex(targetWidgets, targetId, insertAfter)

  if (insertIndex === -1) return layout

  targetWidgets.splice(insertIndex, 0, widget)

  return {
    ...layout,
    columns: layout.columns.map((column) => {
      if (column.id === sourceColumn.id) {
        return {
          ...column,
          widgets: column.widgets.filter(({ id }) => id !== activeId),
        }
      }

      if (column.id === targetColumn.id) {
        return { ...column, widgets: targetWidgets }
      }

      return column
    }),
  }
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

function shouldInsertAfter(event: DragEndEvent) {
  const overRect = event.over?.rect
  const activeRect = event.active.rect.current.translated

  if (!overRect || !activeRect) return false

  const activeCenterY = activeRect.top + activeRect.height / 2
  const targetCenterY = overRect.top + overRect.height / 2

  return activeCenterY > targetCenterY
}

interface WidgetConfigurationProps {
  widget: ProfileWidget
  onChange: (
    widgetId: string,
    field: 'title' | 'content',
    value: string,
  ) => void
}

function WidgetConfiguration({ widget, onChange }: WidgetConfigurationProps) {
  if (widget.type !== 'featured' && widget.type !== 'customText') {
    return null
  }

  const isFeatured = widget.type === 'featured'

  return (
    <div className="flex flex-col gap-3 border-t border-current/20 pt-3">
      {isFeatured && (
        <label className="flex flex-col gap-1 text-sm">
          Spotlight title
          <input
            type="text"
            value={widget.config?.title ?? ''}
            onChange={(event) =>
              onChange(widget.id, 'title', event.target.value)
            }
            maxLength={160}
            className="bg-background-blend rounded border border-current/30 p-2"
            placeholder="Enter a title..."
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {isFeatured ? 'Spotlight content' : 'Custom text content'}
        <textarea
          value={widget.config?.content ?? ''}
          onChange={(event) =>
            onChange(widget.id, 'content', event.target.value)
          }
          maxLength={20000}
          rows={5}
          className="bg-background-blend rounded border border-current/30 p-2"
          placeholder="Write your content..."
        />
      </label>
    </div>
  )
}

interface WidgetPickerProps {
  layout: ProfileLayout
  onAdd: (type: ProfileWidget['type']) => void
}

function WidgetPicker({ layout, onAdd }: WidgetPickerProps) {
  const hasBio = layout.columns.some(({ widgets }) =>
    widgets.some(({ type }) => type === 'bio'),
  )

  return (
    <div className="bg-background-blend rounded border border-current/20 p-4">
      <h3 className="mb-3 font-bold">Add widgets</h3>

      <div className="flex flex-wrap gap-2">
        {availableWidgets.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => onAdd(item.type)}
            disabled={item.type === 'bio' && hasBio}
            className="bg-background-blend rounded border border-current/30 px-3 py-2 text-sm transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-30"
          >
            + {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface WidgetColumnProps {
  column: ProfileLayout['columns'][number]
  widgetIds: string[]
  onRemove: (widgetId: string) => void
  onConfigChange: (
    widgetId: string,
    field: 'title' | 'content',
    value: string,
  ) => void
}

function WidgetColumn({
  column,
  widgetIds,
  onRemove,
  onConfigChange,
}: WidgetColumnProps) {
  return (
    <DroppableColumn columnId={column.id} widgetIds={widgetIds}>
      <h3 className="font-bold">
        {column.id === 'main' ? 'Main column' : 'Sidebar'}
      </h3>

      {column.widgets.map((widget) => (
        <SortableWidget
          key={widget.id}
          widgetId={widget.id}
          label={getWidgetLabel(widget.type)}
          onRemove={() => onRemove(widget.id)}
        >
          <WidgetConfiguration widget={widget} onChange={onConfigChange} />
        </SortableWidget>
      ))}

      {column.widgets.length === 0 && (
        <p className="rounded border border-dashed border-current/30 p-6 text-center text-sm opacity-50">
          Drop widgets here
        </p>
      )}

      <p className="mt-auto text-xs opacity-40">
        Drag widgets to reorder or move them here.
      </p>
    </DroppableColumn>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function updateLayoutWidgets(
  layout: ProfileLayout,
  update: (widget: ProfileWidget) => ProfileWidget | null,
): ProfileLayout {
  return {
    ...layout,
    columns: layout.columns.map((column) => ({
      ...column,
      widgets: column.widgets.flatMap((widget) => {
        const updated = update(widget)
        return updated ? [updated] : []
      }),
    })),
  }
}

function ProfileEditor() {
  const [layout, setLayout] = useState<ProfileLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingLayout, setSavingLayout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [layoutSuccess, setLayoutSuccess] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const [customCss, setCustomCss] = useState('')

  const [loadingCss, setLoadingCss] = useState(true)
  const [savingCss, setSavingCss] = useState(false)
  const [cssError, setCssError] = useState<string | null>(null)
  const [cssSuccess, setCssSuccess] = useState(false)

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

  async function saveCss() {
    try {
      setSavingCss(true)
      setCssError(null)
      setCssSuccess(false)

      const response = await profilesApi.updateMyCustomization({
        customCss,
      })

      setCustomCss(response.data.customCss ?? '')
      setCssSuccess(true)
    } catch (err) {
      setCssError(getErrorMessage(err, 'Failed to save custom CSS.'))
    } finally {
      setSavingCss(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadCss() {
      try {
        setLoadingCss(true)
        setCssError(null)

        const response = await profilesApi.getMyCustomization()

        if (!cancelled) {
          setCustomCss(response.data.customCss ?? '')
        }
      } catch (err) {
        if (!cancelled) {
          setCssError(getErrorMessage(err, 'Failed to load custom CSS.'))
        }
      } finally {
        if (!cancelled) {
          setLoadingCss(false)
        }
      }
    }

    loadCss()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadEditor() {
      try {
        setLoading(true)
        setError(null)

        const layoutResponse = await profilesApi.getMyLayout()

        if (cancelled) return

        const currentLayout = layoutResponse.data.layout
        setLayout(currentLayout)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Failed to load profile editor.'))
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
      setError(getErrorMessage(err, 'Failed to save profile layout.'))
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
        current.columns.some(({ widgets }) =>
          widgets.some(({ type }) => type === 'bio'),
        )
      ) {
        return current
      }

      const newWidget: ProfileWidget = {
        id: `${type}-${crypto.randomUUID()}`,
        type,
      }

      if (type === 'featured') {
        newWidget.config = {
          title: 'Spotlight',
          content: '',
        }
      }

      if (type === 'customText') {
        newWidget.config = {
          content:
            '<div style="background: rgba(200, 200, 200, 0.6); padding: 20px; border-radius: 8px;"><h2>Welcome to my space!</h2><p>Tell visitors a little about yourself, your interests, your creative work, or anything you would like to share.</p></div>',
        }
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
    setLayout((current) =>
      current
        ? updateLayoutWidgets(current, (widget) =>
            widget.id === widgetId ? null : widget,
          )
        : current,
    )

    setLayoutSuccess(false)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    setActiveDragId(null)

    if (!over || active.id === over.id) return

    setLayout((current) =>
      current
        ? moveWidget(
            current,
            String(active.id),
            String(over.id),
            shouldInsertAfter(event),
          )
        : current,
    )

    setLayoutSuccess(false)
  }

  function handleDragCancel() {
    setActiveDragId(null)
  }

  function updateWidgetConfig(
    widgetId: string,
    field: 'title' | 'content',
    value: string,
  ) {
    setLayout((current) =>
      current
        ? updateLayoutWidgets(current, (widget) =>
            widget.id === widgetId
              ? {
                  ...widget,
                  config: {
                    ...widget.config,
                    [field]: value,
                  },
                }
              : widget,
          )
        : current,
    )

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
        .flatMap(({ widgets }) => widgets)
        .find(({ id }) => id === activeDragId)
    : null

  const activeWidgetLabel = activeWidget
    ? getWidgetLabel(activeWidget.type)
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

        <WidgetPicker layout={layout} onAdd={addWidget} />

        {/* Layout columns */}
        <DndContext
          sensors={sensors}
          collisionDetection={profileCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {layout.columns.map((column) => (
              <WidgetColumn
                key={column.id}
                column={column}
                widgetIds={column.widgets.map((widget) => widget.id)}
                onRemove={removeWidget}
                onConfigChange={updateWidgetConfig}
              />
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

      {/* Custom CSS editor */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">Custom CSS</h2>

          <HorizontalHR />

          <p className="mt-1 text-sm opacity-60">
            Customize the appearance of your public profile using CSS.
          </p>
        </div>

        {loadingCss ? (
          <p className="text-sm opacity-60">Loading CSS editor...</p>
        ) : (
          <>
            <textarea
              value={customCss}
              onChange={(event) => {
                setCustomCss(event.target.value)
                setCssSuccess(false)
              }}
              maxLength={50_000}
              rows={20}
              spellCheck={false}
              className="bg-background-blend w-full resize-y rounded border border-current/30 p-4 font-mono text-sm"
              placeholder="/* Your profile styles */"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs opacity-50">
                {customCss.length.toLocaleString()} / 50,000 characters
              </p>

              <button
                type="button"
                onClick={saveCss}
                disabled={savingCss}
                className="save"
              >
                {savingCss ? 'Saving...' : 'Save CSS'}
              </button>
            </div>
          </>
        )}

        {cssError && (
          <p role="alert" className="error-feedback">
            {cssError}
          </p>
        )}

        {cssSuccess && (
          <p role="status" className="text-green-500">
            Custom CSS saved.
          </p>
        )}
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
