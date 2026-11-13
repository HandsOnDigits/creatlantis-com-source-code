import { useEffect, useState, type FormEvent } from 'react'

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  createdAt: string
  updatedAt: string
}

const API_URL = 'http://localhost:3001/api'

const inputClass =
  'w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-white outline-none focus:border-blue-500'

const buttonClass =
  'rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadCategories() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/categories`, {
        credentials: 'include',
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Could not load categories.')
      }

      setCategories(result.data)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not load categories.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [])

  function resetForm() {
    setName('')
    setSlug('')
    setDescription('')
    setEditingId(null)
  }

  function startEditing(category: Category) {
    setEditingId(category.id)
    setName(category.name)
    setSlug(category.slug)
    setDescription(category.description ?? '')
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim() || null,
    }

    try {
      const response = await fetch(
        editingId === null
          ? `${API_URL}/categories`
          : `${API_URL}/categories/${editingId}`,
        {
          method: editingId === null ? 'POST' : 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      const result = response.status === 204 ? null : await response.json()

      if (!response.ok) {
        throw new Error(result?.error ?? 'Could not save category.')
      }

      setSuccess(
        editingId === null
          ? 'Category created successfully.'
          : 'Category updated successfully.',
      )

      resetForm()
      await loadCategories()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save category.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: Category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"? This will remove its category assignments from posts.`,
    )

    if (!confirmed) return

    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_URL}/categories/${category.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error ?? 'Could not delete category.')
      }

      if (editingId === category.id) {
        resetForm()
      }

      setSuccess('Category deleted successfully.')
      await loadCategories()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not delete category.',
      )
    }
  }

  return (
    <section className="border-admin-border bg-admin-bg space-y-6 rounded-xl border p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Category management
        </h2>
        <p className="text-admin-muted mt-1 text-sm">
          Create, edit and delete creative categories.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-admin-muted mb-1 block text-sm">
            Category name
          </label>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Photography"
            maxLength={100}
            required
          />
        </div>

        <div>
          <label className="text-admin-muted mb-1 block text-sm">Slug</label>
          <input
            className={inputClass}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="photography"
            maxLength={120}
            pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*"
            title="Use letters, numbers and single hyphens."
            required
          />
        </div>

        <div>
          <label className="text-admin-muted mb-1 block text-sm">
            Description
          </label>
          <textarea
            className={inputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A category for photographic artwork."
            maxLength={1000}
            rows={3}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim() || !slug.trim()}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-500`}
          >
            {saving
              ? 'Saving...'
              : editingId === null
                ? 'Create category'
                : 'Save changes'}
          </button>

          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className={`${buttonClass} border-admin-border border text-white hover:bg-white/5`}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          {success}
        </p>
      )}

      <div className="border-admin-border border-t pt-5">
        <h3 className="mb-4 text-sm font-semibold text-white">
          Existing categories ({categories.length})
        </h3>

        {loading ? (
          <p className="text-admin-muted text-sm">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-admin-muted text-sm">No categories found.</p>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="border-admin-border flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{category.name}</p>
                  <p className="text-admin-muted text-xs">/{category.slug}</p>
                  {category.description && (
                    <p className="text-admin-muted mt-1 text-sm">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(category)}
                    className={`${buttonClass} border-admin-border border text-white hover:bg-white/5`}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete(category)}
                    className={`${buttonClass} border border-red-500/30 text-red-400 hover:bg-red-500/10`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
