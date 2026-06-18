'use client'

/**
 * Admin Game Management v2 — /admin/games  (Phase B, parallel route)
 *
 * Sits alongside the original /admin/games. Reads game metadata via the
 * existing fetchAdminGames() action (unchanged) and category enablement
 * via the new fetchAdminGameCategoryBadges() action that hits
 * game_categories + global_categories.
 *
 * This page:
 *   - Lists games with category badges sourced from the new schema
 *   - Opens a wizard at /admin/games/new and /admin/games/[id]/edit
 *     (wizard added in a follow-up commit — links present here, pages stubbed)
 *   - Does NOT touch the live /admin/games. Old route keeps working as-is.
 */

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search, Pencil, Eye, EyeOff, ChevronRight, Pause, Play, Trash2, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { fetchAdminGames, toggleGameActive, deleteGame, toggleGamePopular } from '@/lib/actions/admin-games'
import {
  fetchAdminGameCategoryBadges,
  type AdminGameCategoryBadge,
} from '@/lib/actions/admin-game-categories'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { AddGameDialog } from './_components/AddGameDialog'

interface Game {
  id: string
  name: string
  slug: string
  emoji: string | null
  image_url: string | null
  display_name: string | null
  sort_order: number
  is_active: boolean
  is_popular?: boolean | null
  listing_count?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBadges(badges: AdminGameCategoryBadge[]) {
  const m = new Map<string, AdminGameCategoryBadge[]>()
  for (const b of badges) {
    const arr = m.get(b.game_id) ?? []
    arr.push(b)
    m.set(b.game_id, arr)
  }
  // Stable order: by category_slug
  m.forEach((arr) => {
    arr.sort((a: AdminGameCategoryBadge, b: AdminGameCategoryBadge) =>
      a.category_slug.localeCompare(b.category_slug)
    )
  })
  return m
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGamesV2Page() {
  const [filter, setFilter] = useState('')
  // V17l — Pending-delete game lives in local state so the confirm
  // dialog can read it. Cleared on cancel/success.
  const [pendingDelete, setPendingDelete] = useState<Game | null>(null)
  const qc = useQueryClient()

  const gamesQuery = useQuery<Game[]>({
    queryKey: ['admin-games', 'list'],
    queryFn: () => fetchAdminGames() as unknown as Promise<Game[]>,
    staleTime: 30_000,
  })

  // V17l — Pause/resume mutation. The action takes the current state
  // and flips it (server-side), so we pass `is_active` as-is.
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleGameActive(id, isActive),
    onSuccess: (res, vars) => {
      if (res.success) {
        toast.success(vars.isActive ? 'Game paused' : 'Game activated')
        qc.invalidateQueries({ queryKey: ['admin-games'] })
      } else {
        toast.error(res.error ?? 'Failed to update game')
      }
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update game'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGame(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Game deleted')
        setPendingDelete(null)
        qc.invalidateQueries({ queryKey: ['admin-games'] })
      } else {
        toast.error(res.error ?? 'Failed to delete game')
      }
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to delete game'),
  })

  // V17s — Toggle the "popular" flag for homepage curation. Same
  // optimistic-flip pattern as pause/activate.
  const popularMutation = useMutation({
    mutationFn: ({ id, isPopular }: { id: string; isPopular: boolean }) =>
      toggleGamePopular(id, isPopular),
    onSuccess: (res, vars) => {
      if (res.success) {
        toast.success(vars.isPopular ? 'Removed from popular' : 'Marked as popular')
        qc.invalidateQueries({ queryKey: ['admin-games'] })
      } else {
        toast.error(res.error ?? 'Failed to update popular flag')
      }
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update popular flag'),
  })

  const badgesQuery = useQuery<AdminGameCategoryBadge[]>({
    queryKey: ['admin-games', 'badges'],
    queryFn: fetchAdminGameCategoryBadges,
    staleTime: 30_000,
  })

  const badgesByGame = useMemo(
    () => groupBadges(badgesQuery.data ?? []),
    [badgesQuery.data]
  )

  const filtered = (gamesQuery.data ?? []).filter((g) => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return g.name.toLowerCase().includes(f) || g.slug.includes(f)
  })

  const activeCount = (gamesQuery.data ?? []).filter((g) => g.is_active).length
  const isLoading = gamesQuery.isLoading || badgesQuery.isLoading

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-text-primary">Games</h1>
          <p className="mt-1.5 text-[13.5px] text-text-secondary">
            {gamesQuery.data
              ? <>{activeCount} active · {gamesQuery.data.length} total</>
              : 'Loading…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter games…"
              className="h-10 w-64 rounded-xl border border-border-default bg-bg-raised pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
            />
          </div>
          <AddGameDialog />
        </div>
      </header>

      {/* ── List ── */}
      <GlassCard intensity="light" noPadding rounded="2xl">
        {/* Column headings */}
        <div className="grid grid-cols-[60px_1.4fr_1.4fr_100px_110px_156px] items-center gap-3 border-b border-border-subtle px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          <span>Logo</span>
          <span>Name</span>
          <span>Categories enabled</span>
          <span>Listings</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Rows */}
        <div>
          {isLoading ? (
            <div className="px-5 py-16 text-center text-sm text-text-tertiary">Loading games…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-text-tertiary">
              No games match "{filter}"
            </div>
          ) : (
            filtered.map((game) => {
              const badges = badgesByGame.get(game.id) ?? []
              return (
                <div
                  key={game.id}
                  className={cn(
                    'grid grid-cols-[60px_1.4fr_1.4fr_100px_110px_156px] items-center gap-3 border-b border-border-subtle px-5 py-4 text-sm transition-colors hover:bg-bg-base',
                    !game.is_active && 'bg-red-500/[0.025]'
                  )}
                >
                  {/* Logo */}
                  <div className={cn('flex items-center', !game.is_active && 'opacity-60')}>
                    {game.image_url ? (
                      // Using <img> intentionally — Next/Image not needed at this density
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-raised text-xl ring-1 ring-white/10">
                        {game.emoji ?? '🎮'}
                      </div>
                    )}
                  </div>

                  {/* Name + slug */}
                  <div className={cn(!game.is_active && 'opacity-60')}>
                    <div className="text-[14px] font-semibold text-text-primary">{game.name}</div>
                    <div className="mt-0.5 font-mono text-[12px] text-text-tertiary">{game.slug}</div>
                  </div>

                  {/* Category badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {badges.length === 0 ? (
                      <span className="text-[12.5px] text-text-disabled">— none enabled</span>
                    ) : (
                      badges.map((b) => (
                        <span
                          key={b.game_category_id}
                          title={!b.is_active_global ? `${b.category_name} (disabled at launch)` : b.category_name}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px]',
                            b.is_active_global
                              ? 'border-border-default bg-bg-raised text-text-secondary'
                              : 'border-warning bg-warning-bg text-warning'
                          )}
                        >
                          <span aria-hidden>{b.icon_emoji ?? '•'}</span>
                          {b.category_name}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Listings */}
                  <div className={cn(!game.is_active && 'opacity-60')}>
                    <span className="inline-flex h-6 items-center rounded-full bg-bg-raised px-2.5 text-[12px] font-semibold text-text-secondary ring-1 ring-inset ring-white/[0.06]">
                      {game.listing_count ?? 0}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium',
                        game.is_active
                          ? 'bg-success-bg text-success'
                          : 'bg-red-500/15 text-red-400'
                      )}
                    >
                      {game.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {game.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  {/* V17l/V17s — Row actions: popular star, pause/resume,
                      edit, delete. The star flips games.is_popular so the
                      homepage Popular Games shelf surfaces this game. */}
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => popularMutation.mutate({ id: game.id, isPopular: !!game.is_popular })}
                      disabled={popularMutation.isPending}
                      title={game.is_popular ? 'Remove from Popular Games' : 'Mark as popular'}
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50',
                        game.is_popular
                          ? 'text-lime hover:bg-lime-tint-bg'
                          : 'text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                      )}
                    >
                      <Star
                        className={cn(
                          'h-3.5 w-3.5',
                          game.is_popular && 'fill-current',
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: game.id, isActive: game.is_active })}
                      disabled={toggleMutation.isPending}
                      title={game.is_active ? 'Pause' : 'Activate'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary disabled:opacity-50"
                    >
                      {game.is_active
                        ? <Pause className="h-3.5 w-3.5" />
                        : <Play className="h-3.5 w-3.5" />
                      }
                    </button>
                    <Link
                      href={`/admin/games/${game.id}/edit`}
                      title="Edit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(game)}
                      title="Delete"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-error-bg hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </GlassCard>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[12px] text-text-tertiary">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          Active games are visible in the marketplace
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-warning" />
          Amber category badges = the global category is disabled at launch (Boosting)
        </span>
        <span className="inline-flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-lime-text" />
          Click <span className="font-semibold text-text-secondary">Edit</span> to open the wizard
        </span>
      </div>

      {/* V17l — Delete confirmation. Two-step pattern so admins don't
          drop a game with a single mis-click; the action cascades to
          listings via FK so it's not reversible. */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the game and unlinks its categories. Active listings
              will be cascaded to deleted state. There's no undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-lg border border-border-default bg-bg-raised px-4 py-2 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-error px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-60"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete game'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
