'use client'

/**
 * Admin Game Management — /admin/games
 *
 * CRUD interface for the `games` table.
 * Uses service-role server actions for ALL reads + writes (bypasses RLS).
 * Inactive games stay visible so they can be reactivated.
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircle, Pencil, Eye, EyeOff, Save, X, Loader2, Trash2, ChevronDown, ChevronRight, FolderOpen, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchAdminGames,
  updateGame,
  insertGame,
  toggleGameActive,
  deleteGame,
  uploadGameIcon,
  deleteGameIcon,
} from '@/lib/actions/admin-games'
import {
  fetchAdminCategories,
  updateCategory,
  insertCategory,
  deleteCategory,
  toggleCategoryActive,
  uploadCategoryIcon,
  deleteCategoryIcon,
  type CategoryData,
} from '@/lib/actions/admin-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Game {
  id: string
  name: string
  slug: string
  emoji: string | null
  image_url: string | null
  display_name: string | null
  sort_order: number
  is_active: boolean
  listing_count?: number
}

interface Category {
  id: string
  game_id: string | null
  name: string
  slug: string
  description: string | null
  icon_emoji: string | null
  icon_url: string | null
  icon_type: 'emoji' | 'image' | 'svg' | null
  sort_order: number
  is_active: boolean
  listing_count?: number
}

const EMPTY_GAME: Omit<Game, 'id' | 'listing_count'> = {
  name: '',
  slug: '',
  emoji: '🎮',
  image_url: '',
  display_name: '',
  sort_order: 99,
  is_active: true,
}

const EMPTY_CATEGORY: Omit<Category, 'id' | 'listing_count'> = {
  game_id: null,
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

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

function EditRow({
  game,
  onSave,
  onCancel,
  saving,
}: {
  game: Partial<Game>
  onSave: (data: Partial<Game>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_GAME, ...game })

  const set = (key: keyof typeof form, value: any) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <tr className="border-b border-white/[0.05] bg-violet-500/[0.04]">
      <td className="px-4 py-3">
        <Input
          value={form.emoji || ''}
          onChange={(e) => set('emoji', e.target.value)}
          className="h-8 w-14 border-white/10 bg-white/5 text-center text-lg text-white"
          placeholder="🎮"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.name}
          onChange={(e) => {
            set('name', e.target.value)
            if (!game.id) set('slug', toSlug(e.target.value))
          }}
          className="h-8 border-white/10 bg-white/5 text-white"
          placeholder="Game name"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.slug}
          onChange={(e) => set('slug', toSlug(e.target.value))}
          className="h-8 border-white/10 bg-white/5 font-mono text-sm text-white"
          placeholder="game-slug"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.display_name || ''}
          onChange={(e) => set('display_name', e.target.value)}
          className="h-8 border-white/10 bg-white/5 text-white"
          placeholder="Short name"
        />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        Save first, then upload →
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

// ─── Game Icon Upload Cell ────────────────────────────────────────────────────

function GameIconUploadCell({
  gameId,
  currentIcon,
  onUploadSuccess,
}: {
  gameId: string
  currentIcon: string | null
  onUploadSuccess: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = async () => {
        const base64 = reader.result as string
        const result = await uploadGameIcon(gameId, {
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
        })

        if (result.success) {
          onUploadSuccess()
        } else {
          alert(`Upload failed: ${result.error}`)
        }
        setUploading(false)
      }

      reader.onerror = () => {
        alert('Failed to read file')
        setUploading(false)
      }
    } catch (error) {
      alert('Upload failed')
      setUploading(false)
    }

    e.target.value = '' // Reset input
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this icon? Game will revert to emoji.')) return
    setDeleting(true)
    const result = await deleteGameIcon(gameId)
    if (result.success) {
      onUploadSuccess()
    } else {
      alert(`Delete failed: ${result.error}`)
    }
    setDeleting(false)
  }

  const showImage = currentIcon && currentIcon.startsWith('http')

  return (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors">
        {uploading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading...
          </span>
        ) : (
          'Upload'
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {showImage && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          {deleting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Deleting...
            </span>
          ) : (
            'Delete'
          )}
        </button>
      )}
    </div>
  )
}

// ─── Category Icon Upload Cell ────────────────────────────────────────────────

function IconUploadCell({
  categoryId,
  currentIcon,
  iconType,
  onUploadSuccess,
}: {
  categoryId: string
  currentIcon: string | null
  iconType: 'emoji' | 'image' | 'svg' | null
  onUploadSuccess: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    e.target.value = '' // Reset input
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this icon? Category will revert to emoji.')) return
    setDeleting(true)
    const result = await deleteCategoryIcon(categoryId)
    if (result.success) {
      onUploadSuccess()
    } else {
      alert(`Delete failed: ${result.error}`)
    }
    setDeleting(false)
  }

  const showImage = iconType === 'image' || iconType === 'svg'

  return (
    <div className="flex items-center gap-2">
      {showImage && currentIcon ? (
        <div className="flex items-center gap-2">
          <img
            src={currentIcon}
            alt="Category icon"
            className="h-6 w-6 rounded object-cover"
          />
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
          </button>
        </div>
      ) : (
        <span className="text-lg">{currentIcon || '📦'}</span>
      )}
      <label className="cursor-pointer rounded px-2 py-0.5 text-xs text-violet-400 hover:bg-violet-500/10">
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Upload'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  )
}

// ─── Category Edit Row ─────────────────────────────────────────────────────────

function CategoryEditRow({
  category,
  gameId,
  onSave,
  onCancel,
  saving,
}: {
  category: Partial<Category>
  gameId: string
  onSave: (data: Partial<Category>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({ ...EMPTY_CATEGORY, ...category, game_id: gameId })

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
      <td className="px-4 py-3" />
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

// ─── Game Categories Section ───────────────────────────────────────────────────

function GameCategoriesSection({
  gameId,
  gameName,
  onClose,
}: {
  gameId: string
  gameName: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [savingCatId, setSavingCatId] = useState<string | null>(null)
  const [togglingCatId, setTogglingCatId] = useState<string | null>(null)
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories', gameId],
    queryFn: () => fetchAdminCategories(gameId),
    staleTime: 30000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-categories', gameId] })
    queryClient.invalidateQueries({ queryKey: ['admin-games'] })
  }

  const handleToggleActive = async (category: Category) => {
    const action = category.is_active ? 'pause' : 'resume'
    if (!window.confirm(`${action === 'pause' ? 'Pause' : 'Resume'} "${category.name}"?`)) return

    setTogglingCatId(category.id)
    const result = await toggleCategoryActive(category.id, category.is_active)
    if (result.success) {
      refresh()
    } else {
      alert(`Error: ${result.error}`)
    }
    setTogglingCatId(null)
  }

  const handleSaveEdit = async (data: Partial<Category>) => {
    if (!editingCatId) return
    setSavingCatId(editingCatId)
    const result = await updateCategory(editingCatId, {
      name: data.name!,
      slug: data.slug!,
      game_id: gameId,
      description: data.description,
      icon_emoji: data.icon_emoji,
      icon_url: data.icon_url,
      icon_type: data.icon_type ?? undefined,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    if (result.success) {
      refresh()
      setEditingCatId(null)
    } else {
      alert(`Error: ${result.error}`)
    }
    setSavingCatId(null)
  }

  const handleAddNew = async (data: Partial<Category>) => {
    setSavingCatId('new')
    const result = await insertCategory({
      name: data.name!,
      slug: data.slug!,
      game_id: gameId,
      description: data.description,
      icon_emoji: data.icon_emoji,
      icon_url: data.icon_url,
      icon_type: data.icon_type ?? undefined,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    if (result.success) {
      refresh()
      setAddingNew(false)
    } else {
      alert(`Error: ${result.error}`)
    }
    setSavingCatId(null)
  }

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`DELETE "${category.name}"? This cannot be undone.`)) return

    setDeletingCatId(category.id)
    const result = await deleteCategory(category.id)
    if (result.success) {
      refresh()
    } else {
      alert(`Error: ${result.error}`)
    }
    setDeletingCatId(null)
  }

  return (
    <tr>
      <td colSpan={9} className="bg-black/20 p-0">
        <div className="border-t border-white/[0.07] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-medium text-white">
                Categories for {gameName}
              </h3>
              <span className="text-xs text-gray-500">
                ({categories?.length || 0} categories)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 gap-1 bg-violet-600 px-2 text-xs hover:bg-violet-500"
                onClick={() => { setAddingNew(true); setEditingCatId(null) }}
                disabled={addingNew}
              >
                <PlusCircle className="h-3 w-3" />
                Add Category
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
                Close
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Icon</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Name</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Slug</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Description</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Order</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Icon Upload</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Listings</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {addingNew && (
                  <CategoryEditRow
                    category={{}}
                    gameId={gameId}
                    onSave={handleAddNew}
                    onCancel={() => setAddingNew(false)}
                    saving={savingCatId === 'new'}
                  />
                )}

                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : categories?.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-gray-500">
                      No categories yet. Click "Add Category" to create one.
                    </td>
                  </tr>
                ) : (
                  categories?.map((cat) =>
                    editingCatId === cat.id ? (
                      <CategoryEditRow
                        key={cat.id}
                        category={cat}
                        gameId={gameId}
                        onSave={handleSaveEdit}
                        onCancel={() => setEditingCatId(null)}
                        saving={savingCatId === cat.id}
                      />
                    ) : (
                      <tr
                        key={cat.id}
                        className={cn(
                          'border-b border-white/[0.04] transition-colors',
                          cat.is_active
                            ? 'hover:bg-white/[0.03]'
                            : 'bg-red-500/[0.04] hover:bg-red-500/[0.06]'
                        )}
                      >
                        <td className={cn('px-4 py-2 text-lg', !cat.is_active && 'opacity-50')}>
                          {cat.icon_type === 'image' || cat.icon_type === 'svg' ? (
                            cat.icon_url ? (
                              <img src={cat.icon_url} alt="" className="h-5 w-5 rounded object-cover" />
                            ) : (
                              cat.icon_emoji || '📦'
                            )
                          ) : (
                            cat.icon_emoji || '📦'
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn('text-sm font-medium text-white', !cat.is_active && 'opacity-50')}>
                            {cat.name}
                          </span>
                          {!cat.is_active && (
                            <span className="ml-2 text-xs font-normal text-red-400">(paused)</span>
                          )}
                        </td>
                        <td className={cn('px-4 py-2 font-mono text-xs text-gray-400', !cat.is_active && 'opacity-50')}>
                          {cat.slug}
                        </td>
                        <td className={cn('px-4 py-2 text-xs text-gray-300', !cat.is_active && 'opacity-50')}>
                          {cat.description || <span className="text-gray-600">—</span>}
                        </td>
                        <td className={cn('px-4 py-2 text-sm text-gray-300', !cat.is_active && 'opacity-50')}>
                          {cat.sort_order}
                        </td>
                        <td className="px-4 py-2">
                          <IconUploadCell
                            categoryId={cat.id}
                            currentIcon={cat.icon_type === 'image' || cat.icon_type === 'svg' ? cat.icon_url : cat.icon_emoji}
                            iconType={cat.icon_type}
                            onUploadSuccess={refresh}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-gray-300">
                            {cat.listing_count || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              cat.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {cat.is_active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              title="Edit"
                              onClick={() => { setEditingCatId(cat.id); setAddingNew(false) }}
                              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              title={cat.is_active ? 'Pause' : 'Resume'}
                              onClick={() => handleToggleActive(cat)}
                              disabled={togglingCatId === cat.id}
                              className={cn(
                                'rounded-lg p-1.5 transition-colors',
                                cat.is_active
                                  ? 'text-gray-400 hover:bg-yellow-500/10 hover:text-yellow-400'
                                  : 'text-green-500 hover:bg-green-500/10 hover:text-green-400'
                              )}
                            >
                              {togglingCatId === cat.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : cat.is_active ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              title="Delete permanently"
                              onClick={() => handleDeleteCategory(cat)}
                              disabled={deletingCatId === cat.id}
                              className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              {deletingCatId === cat.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
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
      </td>
    </tr>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminGamesPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)

  // ── Fetch via service-role server action (sees ALL games including inactive) ─
  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ['admin-games'],
    queryFn: () => fetchAdminGames(),
    staleTime: 30000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-games'] })

  // ── Toggle active (pause / resume) with double confirmation ─────────────────
  const handleToggleActive = async (game: Game) => {
    const action = game.is_active ? 'pause' : 'resume'
    const firstMsg = game.is_active
      ? `Pause "${game.name}"? It will be hidden from the marketplace.`
      : `Resume "${game.name}"? It will become visible in the marketplace.`

    if (!window.confirm(firstMsg)) return
    if (!window.confirm(`Are you sure you want to ${action} "${game.name}"? Click OK to confirm.`)) return

    setTogglingId(game.id)
    const result = await toggleGameActive(game.id, game.is_active)
    if (result.success) {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['nav-categories'] })
    } else {
      alert(`Error: ${result.error}`)
    }
    setTogglingId(null)
  }

  // ── Save edited game ─────────────────────────────────────────────────────────
  const handleSaveEdit = async (data: Partial<Game>) => {
    if (!editingId) return
    setSavingId(editingId)
    const result = await updateGame(editingId, {
      name: data.name!,
      slug: data.slug!,
      emoji: data.emoji,
      image_url: data.image_url,
      display_name: data.display_name,
      sort_order: data.sort_order,
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

  // ── Add new game ─────────────────────────────────────────────────────────────
  const handleAddNew = async (data: Partial<Game>) => {
    setSavingId('new')
    const result = await insertGame({
      name: data.name!,
      slug: data.slug!,
      emoji: data.emoji,
      image_url: data.image_url,
      display_name: data.display_name,
      sort_order: data.sort_order,
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

  // ── Delete game permanently with double confirmation ─────────────────────────
  const handleDeleteGame = async (game: Game) => {
    if (!window.confirm(
      `DELETE "${game.name}"?\n\nThis will permanently remove the game and all its categories. This cannot be undone.`
    )) return
    if (!window.confirm(
      `FINAL WARNING: Permanently delete "${game.name}"?\n\nClick OK to delete forever.`
    )) return

    setDeletingId(game.id)
    const result = await deleteGame(game.id)
    if (result.success) {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['nav-categories'] })
    } else {
      alert(`Error: ${result.error}`)
    }
    setDeletingId(null)
  }

  const filtered = (games || []).filter((g) =>
    !filterText || g.name.toLowerCase().includes(filterText.toLowerCase()) || g.slug.includes(filterText.toLowerCase())
  )

  const activeCount = (games || []).filter((g) => g.is_active).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Games</h1>
          <p className="text-sm text-gray-400">
            {activeCount} active / {(games || []).length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/redesign"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-lime-tint-border bg-lime-tint-bg px-3 text-xs font-semibold text-lime-text transition-colors hover:bg-lime/20"
            title="Open the redesigned admin hub"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Try new admin
          </Link>
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter games..."
            className="h-9 w-48 border-white/10 bg-white/5 text-sm text-white placeholder:text-gray-500"
          />
          <Button
            size="sm"
            className="h-9 gap-2 bg-white text-black hover:bg-white/90"
            onClick={() => { setAddingNew(true); setEditingId(null) }}
            disabled={addingNew}
          >
            <PlusCircle className="h-4 w-4" />
            Add Game
          </Button>
        </div>
      </div>

      {/* Legend for inactive */}
      <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/40 inline-block" />
          Paused games remain visible here — use the
          <EyeOff className="w-3 h-3 inline" /> button to resume them
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="px-4 py-3 font-medium text-gray-400">Icon</th>
                <th className="px-4 py-3 font-medium text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-400">Slug</th>
                <th className="px-4 py-3 font-medium text-gray-400">Display Name</th>
                <th className="px-4 py-3 font-medium text-gray-400">Manage Icon</th>
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
                  game={{}}
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
                    No games found
                  </td>
                </tr>
              ) : (
                filtered.map((game) => {
                  if (editingId === game.id) {
                    return (
                      <EditRow
                        key={game.id}
                        game={game}
                        onSave={handleSaveEdit}
                        onCancel={() => setEditingId(null)}
                        saving={savingId === game.id}
                      />
                    )
                  }

                  return (
                    <React.Fragment key={game.id}>
                      <tr
                        className={cn(
                          'border-b border-white/[0.04] transition-colors',
                          game.is_active
                            ? 'hover:bg-white/[0.03]'
                            : 'bg-red-500/[0.04] hover:bg-red-500/[0.06]'
                        )}
                      >
                      <td className={cn('px-4 py-3', !game.is_active && 'opacity-50')}>
                        {game.image_url ? (
                          <img
                            src={game.image_url}
                            alt={game.name}
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <span className="text-2xl">{game.emoji || '🎮'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('font-medium text-white', !game.is_active && 'opacity-50')}>
                          {game.name}
                        </span>
                        {!game.is_active && (
                          <span className="ml-2 text-xs text-red-400 font-normal">(paused)</span>
                        )}
                      </td>
                      <td className={cn('px-4 py-3 font-mono text-xs text-gray-400', !game.is_active && 'opacity-50')}>
                        {game.slug}
                      </td>
                      <td className={cn('px-4 py-3 text-gray-300', !game.is_active && 'opacity-50')}>
                        {game.display_name || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <GameIconUploadCell
                          gameId={game.id}
                          currentIcon={game.image_url || game.emoji}
                          onUploadSuccess={refresh}
                        />
                      </td>
                      <td className={cn('px-4 py-3 text-gray-300', !game.is_active && 'opacity-50')}>
                        {game.sort_order}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-gray-300">
                          {game.listing_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            game.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {game.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Manage Categories */}
                          <button
                            title="Manage Categories"
                            onClick={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors',
                              expandedGameId === game.id
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'text-gray-400 hover:bg-violet-500/10 hover:text-violet-400'
                            )}
                          >
                            {expandedGameId === game.id ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            title="Edit"
                            onClick={() => { setEditingId(game.id); setAddingNew(false) }}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Pause / Resume */}
                          <button
                            title={game.is_active ? 'Pause (hide from marketplace)' : 'Resume (show in marketplace)'}
                            onClick={() => handleToggleActive(game)}
                            disabled={togglingId === game.id}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors',
                              game.is_active
                                ? 'text-gray-400 hover:bg-yellow-500/10 hover:text-yellow-400'
                                : 'text-green-500 hover:bg-green-500/10 hover:text-green-400'
                            )}
                          >
                            {togglingId === game.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : game.is_active ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Delete permanently */}
                          <button
                            title="Delete permanently"
                            onClick={() => handleDeleteGame(game)}
                            disabled={deletingId === game.id}
                            className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            {deletingId === game.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedGameId === game.id && (
                      <GameCategoriesSection
                        gameId={game.id}
                        gameName={game.name}
                        onClose={() => setExpandedGameId(null)}
                      />
                    )}
                  </React.Fragment>
                )
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        <span>• <ChevronRight className="inline w-3 h-3 text-violet-400" /> Click to manage categories for this game</span>
        <span>• <strong className="text-gray-400">Order</strong> — lower number = shown first in navbar</span>
        <span>• <strong className="text-gray-400">Display Name</strong> — short name for tight spaces</span>
        <span>• <EyeOff className="inline w-3 h-3 text-yellow-500" /> Pause hides from marketplace — game stays here so you can resume it</span>
        <span>• <Trash2 className="inline w-3 h-3 text-red-500" /> Delete is permanent and cannot be undone</span>
      </div>
    </div>
  )
}
