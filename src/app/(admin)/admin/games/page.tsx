'use client'

/**
 * Admin Game Management — /admin/games
 *
 * CRUD interface for the `games` table.
 * Uses service-role server actions for ALL reads + writes (bypasses RLS).
 * Inactive games stay visible so they can be reactivated.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircle, Pencil, Eye, EyeOff, Save, X, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchAdminGames,
  updateGame,
  insertGame,
  toggleGameActive,
  deleteGame,
} from '@/lib/actions/admin-games'

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

const EMPTY_GAME: Omit<Game, 'id' | 'listing_count'> = {
  name: '',
  slug: '',
  emoji: '🎮',
  image_url: '',
  display_name: '',
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
      <td className="px-4 py-3">
        <Input
          value={form.image_url || ''}
          onChange={(e) => set('image_url', e.target.value)}
          className="h-8 border-white/10 bg-white/5 text-white"
          placeholder="https://..."
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

export default function AdminGamesPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

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
                <th className="px-4 py-3 font-medium text-gray-400">Emoji</th>
                <th className="px-4 py-3 font-medium text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-400">Slug</th>
                <th className="px-4 py-3 font-medium text-gray-400">Display Name</th>
                <th className="px-4 py-3 font-medium text-gray-400">Image URL</th>
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
                filtered.map((game) =>
                  editingId === game.id ? (
                    <EditRow
                      key={game.id}
                      game={game}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                      saving={savingId === game.id}
                    />
                  ) : (
                    <tr
                      key={game.id}
                      className={cn(
                        'border-b border-white/[0.04] transition-colors',
                        game.is_active
                          ? 'hover:bg-white/[0.03]'
                          : 'bg-red-500/[0.04] hover:bg-red-500/[0.06]'
                      )}
                    >
                      <td className={cn('px-4 py-3 text-xl', !game.is_active && 'opacity-50')}>
                        {game.emoji || '🎮'}
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
                      <td className={cn('px-4 py-3 max-w-[160px] truncate text-xs text-gray-500', !game.is_active && 'opacity-50')}>
                        {game.image_url ? (
                          <span title={game.image_url}>{game.image_url}</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
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
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        <span>• <strong className="text-gray-400">Order</strong> — lower number = shown first in navbar</span>
        <span>• <strong className="text-gray-400">Display Name</strong> — short name for tight spaces</span>
        <span>• <EyeOff className="inline w-3 h-3 text-yellow-500" /> Pause hides from marketplace — game stays here so you can resume it</span>
        <span>• <Trash2 className="inline w-3 h-3 text-red-500" /> Delete is permanent and cannot be undone</span>
      </div>
    </div>
  )
}
