'use client'

/**
 * Admin Game Management v2 — /admin/games-v2  (Phase B, parallel route)
 *
 * Sits alongside the original /admin/games. Reads game metadata via the
 * existing fetchAdminGames() action (unchanged) and category enablement
 * via the new fetchAdminGameCategoryBadges() action that hits
 * game_categories + global_categories.
 *
 * This page:
 *   - Lists games with category badges sourced from the new schema
 *   - Opens a wizard at /admin/games-v2/new and /admin/games-v2/[id]/edit
 *     (wizard added in a follow-up commit — links present here, pages stubbed)
 *   - Does NOT touch the live /admin/games. Old route keeps working as-is.
 */

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Plus, Pencil, Eye, EyeOff, ChevronRight, Sparkles, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { fetchAdminGames } from '@/lib/actions/admin-games'
import {
  fetchAdminGameCategoryBadges,
  type AdminGameCategoryBadge,
} from '@/lib/actions/admin-game-categories'

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

  const gamesQuery = useQuery<Game[]>({
    queryKey: ['admin-games-v2', 'list'],
    queryFn: () => fetchAdminGames() as unknown as Promise<Game[]>,
    staleTime: 30_000,
  })

  const badgesQuery = useQuery<AdminGameCategoryBadge[]>({
    queryKey: ['admin-games-v2', 'badges'],
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
          <div className="mb-3 flex items-center gap-3">
            <Link
              href="/admin/redesign"
              className="inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-3 w-3" />
              Redesign hub
            </Link>
            <span className="text-xs text-text-disabled">·</span>
            <Link
              href="/admin/games"
              className="inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
            >
              Classic admin
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Games</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime-text">
              <Sparkles className="h-3 w-3" />
              new
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
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
          <Link
            href="/admin/games-v2/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-semibold text-text-inverse shadow-sm transition-colors hover:bg-lime-hover"
          >
            <Plus className="h-4 w-4" />
            Add game
          </Link>
        </div>
      </header>

      {/* ── List ── */}
      <GlassCard intensity="light" noPadding rounded="2xl">
        {/* Column headings */}
        <div className="grid grid-cols-[60px_1.4fr_1.4fr_120px_120px_56px] items-center gap-3 border-b border-border-subtle px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          <span>Logo</span>
          <span>Name</span>
          <span>Categories enabled</span>
          <span>Listings</span>
          <span>Status</span>
          <span className="text-right">Edit</span>
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
                    'grid grid-cols-[60px_1.4fr_1.4fr_120px_120px_56px] items-center gap-3 border-b border-border-subtle px-5 py-4 text-sm transition-colors hover:bg-bg-base',
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
                    <div className="font-medium text-text-primary">{game.name}</div>
                    <div className="font-mono text-[11px] text-text-tertiary">{game.slug}</div>
                  </div>

                  {/* Category badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {badges.length === 0 ? (
                      <span className="text-[11px] text-text-disabled">— none enabled</span>
                    ) : (
                      badges.map((b) => (
                        <span
                          key={b.game_category_id}
                          title={!b.is_active_global ? `${b.category_name} (disabled at launch)` : b.category_name}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
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
                    <span className="inline-flex h-6 items-center rounded-full bg-bg-raised px-2 text-[11px] text-text-secondary ring-1 ring-inset ring-white/[0.06]">
                      {game.listing_count ?? 0}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        game.is_active
                          ? 'bg-success-bg text-success'
                          : 'bg-red-500/15 text-red-400'
                      )}
                    >
                      {game.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {game.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  {/* Edit */}
                  <div className="flex justify-end">
                    <Link
                      href={`/admin/games-v2/${game.id}/edit`}
                      title="Edit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </GlassCard>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[11px] text-text-tertiary">
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
          Click <span className="font-semibold text-text-secondary">Edit</span> to open the new wizard
        </span>
      </div>
    </div>
  )
}
