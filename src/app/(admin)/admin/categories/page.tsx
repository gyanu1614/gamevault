'use client'

/**
 * Admin Category Management — /admin/categories
 *
 * CRUD interface for the `categories` table with icon upload support.
 * Uses service-role server actions for ALL reads + writes (bypasses RLS).
 * Supports emoji icons and uploaded image icons.
 */

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircle, Pencil, Eye, EyeOff, Save, X, Loader2, Trash2, Upload, Image as ImageIcon, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchAdminCategories,
  updateCategory,
  insertCategory,
  toggleCategoryActive,
  deleteCategory,
  uploadCategoryIcon,
  deleteCategoryIcon,
} from '@/lib/actions/admin-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon_emoji: string | null
  icon_url: string | null
  icon_type: 'emoji' | 'image' | 'svg'
  sort_order: number
  is_active: boolean
  listing_count?: number
}

const EMPTY_CATEGORY: Omit<Category, 'id' | 'listing_count'> = {
  name: '',
  slug: '',
  description: '',
  icon_emoji: '📦',
  icon_url: null,
  icon_type: 'emoji',
  sort_order: 99,
  is_active: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Icon Upload Component ────────────────────────────────────────────────────

function IconUploadCell({ categoryId, currentIcon, onUploadSuccess }: {
  categoryId: string
  currentIcon: { type: 'emoji' | 'image' | 'svg', emoji: string | null, url: string | null }
  onUploadSuccess: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const result = await uploadCategoryIcon(categoryId, file)
    if (result.success) {
      onUploadSuccess()
    } else {
      alert(`Upload failed: ${result.error}`)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteIcon = async () => {
    if (!window.confirm('Delete uploaded icon and revert to emoji?')) return
    setDeleting(true)
    const result = await deleteCategoryIcon(categoryId)
    if (result.success) {
      onUploadSuccess()
    } else {
      alert(`Delete failed: ${result.error}`)
    }
    setDeleting(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Icon Preview */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        {currentIcon.type === 'emoji' || !currentIcon.url ? (
          <span className="text-xl">{currentIcon.emoji || '📦'}</span>
        ) : (
          <img src={currentIcon.url} alt="" className="h-full w-full rounded-lg object-cover" />
        )}
      </div>

      {/* Upload Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || deleting}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        title="Upload icon image"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Delete Icon Button (only show if image uploaded) */}
      {currentIcon.url && currentIcon.type !== 'emoji' && (
        <button
          onClick={handleDeleteIcon}
          disabled={uploading || deleting}
          className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          title="Delete uploaded icon"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

function EditRow({
  category,
  onSave,
  onCancel,
  saving,
}: {
  category: Partial<Category>
  onSave: (data: Partial<Category>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_CATEGORY, ...category })

  const set = (key: keyof typeof form, value: any) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <tr className="border-b border-white/[0.05] bg-violet-500/[0.04]">
      <td className="px-4 py-3">
        <Input
          value={form.icon_emoji || ''}
          onChange={(e) => set('icon_emoji', e.target.value)}
          className="h-8 w-14 border-white/10 bg-white/5 text-center text-lg text-white"
          placeholder="📦"
        />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">Save first to upload image</span>
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.name}
          onChange={(e) => {
            set('name', e.target.value)
            if (!category.id) set('slug', toSlug(e.target.value))
          }}
          className="h-8 border-white/10 bg-white/5 text-white"
          placeholder="Category name"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.slug}
          onChange={(e) => set('slug', toSlug(e.target.value))}
          className="h-8 border-white/10 bg-white/5 font-mono text-sm text-white"
          placeholder="category-slug"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.description || ''}
          onChange={(e) => set('description', e.target.value)}
          className="h-8 border-white/10 bg-white/5 text-white"
          placeholder="Description"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          value={form.sort_order}
          onChange={(e) => set('sort_order', parseInt(e.target.value) || 99)}
          className="h-8 w-16 border-white/10 bg-white/5 text-white"
        />
      </td>
      {/* colspan for Listings + Status */}
      <td className="px-4 py-3" />
      <td className="px-4 py-3" />
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 gap-1 bg-violet-600 px-2 text-xs hover:bg-violet-500"
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.slug}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
            onClick={onCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  // ── Fetch via service-role server action (sees ALL categories including inactive) ─
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => fetchAdminCategories(),
    staleTime: 30000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })

  // ── Toggle active (pause / resume) with double confirmation ─────────────────
  const handleToggleActive = async (category: Category) => {
    const action = category.is_active ? 'pause' : 'resume'
    const firstMsg = category.is_active
      ? `Pause "${category.name}"? It will be hidden from the marketplace.`
      : `Resume "${category.name}"? It will become visible in the marketplace.`

    if (!window.confirm(firstMsg)) return
    if (!window.confirm(`Are you sure you want to ${action} "${category.name}"? Click OK to confirm.`)) return

    setTogglingId(category.id)
    const result = await toggleCategoryActive(category.id, !category.is_active)
    if (result.success) {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['nav-categories'] })
    } else {
      alert(`Error: ${result.error}`)
    }
    setTogglingId(null)
  }

  // ── Save edited category ─────────────────────────────────────────────────────
  const handleSaveEdit = async (data: Partial<Category>) => {
    if (!editingId) return
    setSavingId(editingId)
    const result = await updateCategory(editingId, {
      name: data.name!,
      slug: data.slug!,
      description: data.description,
      icon_emoji: data.icon_emoji,
      icon_url: data.icon_url,
      icon_type: data.icon_type ?? undefined,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    if (result.success) {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['nav-categories'] })
      setEditingId(null)
    } else {
      alert(`Error: ${result.error}`)
    }
    setSavingId(null)
  }

  // ── Add new category ─────────────────────────────────────────────────────────
  const handleAddNew = async (data: Partial<Category>) => {
    setSavingId('new')
    const result = await insertCategory({
      name: data.name!,
      slug: data.slug!,
      description: data.description,
      icon_emoji: data.icon_emoji,
      icon_url: data.icon_url,
      icon_type: data.icon_type ?? undefined,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    if (result.success) {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['nav-categories'] })
      setAddingNew(false)
    } else {
      alert(`Error: ${result.error}`)
    }
    setSavingId(null)
  }

  // ── Delete category permanently with double confirmation ─────────────────────
  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(
      `DELETE "${category.name}"?\n\nThis will permanently remove the category. This cannot be undone.`
    )) return
    if (!window.confirm(
      `FINAL WARNING: Permanently delete "${category.name}"?\n\nClick OK to delete forever.`
    )) return

    setDeletingId(category.id)
    const result = await deleteCategory(category.id)
    if (result.success) {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['nav-categories'] })
    } else {
      alert(`Error: ${result.error}`)
    }
    setDeletingId(null)
  }

  const filtered = (categories || []).filter((c) =>
    !filterText || c.name.toLowerCase().includes(filterText.toLowerCase()) || c.slug.includes(filterText.toLowerCase())
  )

  const activeCount = (categories || []).filter((c) => c.is_active).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          <p className="text-sm text-gray-400">
            {activeCount} active / {(categories || []).length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/categories-v2"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/15"
            title="Open the redesigned categories admin (5 global categories)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Try new admin
          </Link>
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter categories..."
            className="h-9 w-48 border-white/10 bg-white/5 text-sm text-white placeholder:text-gray-500"
          />
          <Button
            size="sm"
            className="h-9 gap-2 bg-white text-black hover:bg-white/90"
            onClick={() => { setAddingNew(true); setEditingId(null) }}
            disabled={addingNew}
          >
            <PlusCircle className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Legend for inactive */}
      <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/40 inline-block" />
          Paused categories remain visible here — use the
          <EyeOff className="w-3 h-3 inline" /> button to resume them
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="px-4 py-3 font-medium text-gray-400">Emoji</th>
                <th className="px-4 py-3 font-medium text-gray-400">Icon Upload</th>
                <th className="px-4 py-3 font-medium text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-400">Slug</th>
                <th className="px-4 py-3 font-medium text-gray-400">Description</th>
                <th className="px-4 py-3 font-medium text-gray-400">Order</th>
                <th className="px-4 py-3 font-medium text-gray-400">Listings</th>
                <th className="px-4 py-3 font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Add new row */}
              {addingNew && (
                <EditRow
                  category={{}}
                  onSave={handleAddNew}
                  onCancel={() => setAddingNew(false)}
                  saving={savingId === 'new'}
                />
              )}

              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-500">
                    No categories found
                  </td>
                </tr>
              ) : (
                filtered.map((category) =>
                  editingId === category.id ? (
                    <EditRow
                      key={category.id}
                      category={category}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                      saving={savingId === category.id}
                    />
                  ) : (
                    <tr
                      key={category.id}
                      className={cn(
                        'border-b border-white/[0.04] transition-colors',
                        category.is_active
                          ? 'hover:bg-white/[0.03]'
                          : 'bg-red-500/[0.04] hover:bg-red-500/[0.06]'
                      )}
                    >
                      <td className={cn('px-4 py-3 text-xl', !category.is_active && 'opacity-50')}>
                        {category.icon_emoji || '📦'}
                      </td>
                      <td className="px-4 py-3">
                        <IconUploadCell
                          categoryId={category.id}
                          currentIcon={{
                            type: category.icon_type,
                            emoji: category.icon_emoji,
                            url: category.icon_url,
                          }}
                          onUploadSuccess={refresh}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('font-medium text-white', !category.is_active && 'opacity-50')}>
                          {category.name}
                        </span>
                        {!category.is_active && (
                          <span className="ml-2 text-xs text-red-400 font-normal">(paused)</span>
                        )}
                      </td>
                      <td className={cn('px-4 py-3 font-mono text-xs text-gray-400', !category.is_active && 'opacity-50')}>
                        {category.slug}
                      </td>
                      <td className={cn('px-4 py-3 text-gray-300', !category.is_active && 'opacity-50')}>
                        {category.description || <span className="text-gray-600">—</span>}
                      </td>
                      <td className={cn('px-4 py-3 text-gray-300', !category.is_active && 'opacity-50')}>
                        {category.sort_order}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-gray-300">
                          {category.listing_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            category.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {category.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Edit */}
                          <button
                            title="Edit"
                            onClick={() => { setEditingId(category.id); setAddingNew(false) }}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Pause / Resume */}
                          <button
                            title={category.is_active ? 'Pause (hide from marketplace)' : 'Resume (show in marketplace)'}
                            onClick={() => handleToggleActive(category)}
                            disabled={togglingId === category.id}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors',
                              category.is_active
                                ? 'text-gray-400 hover:bg-yellow-500/10 hover:text-yellow-400'
                                : 'text-green-500 hover:bg-green-500/10 hover:text-green-400'
                            )}
                          >
                            {togglingId === category.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : category.is_active ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Delete permanently */}
                          <button
                            title="Delete permanently"
                            onClick={() => handleDeleteCategory(category)}
                            disabled={deletingId === category.id || (category.listing_count ?? 0) > 0}
                            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {deletingId === category.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        <span>• <strong className="text-gray-400">Emoji</strong> — fallback icon when no image uploaded</span>
        <span>• <strong className="text-gray-400">Icon Upload</strong> — upload PNG/JPG/SVG (max 2MB)</span>
        <span>• <strong className="text-gray-400">Order</strong> — lower number = shown first in navbar</span>
        <span>• <EyeOff className="inline w-3 h-3 text-yellow-500" /> Pause hides from marketplace — category stays here so you can resume it</span>
        <span>• <Trash2 className="inline w-3 h-3 text-red-500" /> Delete is permanent and disabled if category has listings</span>
      </div>
    </div>
  )
}
