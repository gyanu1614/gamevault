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

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search, Pencil, Eye, EyeOff, ChevronRight, ChevronDown, Pause, Play, Trash2, Star, Sparkles, Radar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { fetchAdminGames, toggleGameActive, deleteGame, toggleGamePopular, toggleGameSpotlight } from '@/lib/actions/admin-games'
import {
  fetchAdminGameCategoryBadges,
  type AdminGameCategoryBadge,
} from '@/lib/actions/admin-game-categories'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { AddGameDialog } from './AddGameDialog'
import { TrendReviewCard } from './TrendReviewCard'

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
  is_spotlight?: boolean | null
  seo_indexable?: boolean | null
  listing_count?: number
  // Step 2 — trend radar review state (games.review_status).
  review_status?: 'pending' | 'approved' | 'rejected' | 'declining' | null
  review_note?: string | null
  review_snoozed_until?: string | null
  trend_detected_at?: string | null
  source?: string | null
}

type StatusFilter = 'all' | 'pending' | 'declining'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'declining', label: 'Declining' },
]

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

export default function GamesPageClient({
  initialGames,
  initialBadges,
}: {
  initialGames: Game[]
  initialBadges: AdminGameCategoryBadge[]
}) {
  const [filter, setFilter] = useState('')
  // Step 2 — the Discord alert links to /admin/games?status=pending#<slug>:
  // the chip comes from the query string, the open card from the hash.
  const searchParams = useSearchParams()
  const initialStatus = searchParams?.get('status')
  const [status, setStatus] = useState<StatusFilter>(
    initialStatus === 'pending' || initialStatus === 'declining' ? initialStatus : 'all',
  )
  const [openReview, setOpenReview] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const slug = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
    if (slug) setOpenReview(new Set([slug]))
  }, [])
  const toggleReview = (slug: string) =>
    setOpenReview((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  // V17l — Pending-delete game lives in local state so the confirm
  // dialog can read it. Cleared on cancel/success.
  const [pendingDelete, setPendingDelete] = useState<Game | null>(null)
  const qc = useQueryClient()

  const gamesQuery = useQuery<Game[]>({
    queryKey: ['admin-games', 'list'],
    queryFn: () => fetchAdminGames() as unknown as Promise<Game[]>,
    // V54 — Server-seeded: the page arrives rendered (no "Loading
    // games…" flash on refresh). initialData counts as fresh for
    // staleTime, so no immediate client refetch either; mutations
    // invalidate and refetch as before.
    initialData: initialGames,
    staleTime: 60_000,
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

  // Toggle the "spotlight" flag — features the game in the mobile
  // hamburger Spotlight grid. Same optimistic-flip pattern.
  const spotlightMutation = useMutation({
    mutationFn: ({ id, isSpotlight }: { id: string; isSpotlight: boolean }) =>
      toggleGameSpotlight(id, isSpotlight),
    onSuccess: (res, vars) => {
      if (res.success) {
        toast.success(vars.isSpotlight ? 'Removed from spotlight' : 'Added to spotlight')
        qc.invalidateQueries({ queryKey: ['admin-games'] })
      } else {
        toast.error(res.error ?? 'Failed to update spotlight flag')
      }
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update spotlight flag'),
  })

  const badgesQuery = useQuery<AdminGameCategoryBadge[]>({
    queryKey: ['admin-games', 'badges'],
    queryFn: fetchAdminGameCategoryBadges,
    initialData: initialBadges,
    staleTime: 60_000,
  })

  const badgesByGame = useMemo(
    () => groupBadges(badgesQuery.data ?? []),
    [badgesQuery.data]
  )

  const reviewCounts = useMemo(() => {
    const all = gamesQuery.data ?? []
    return {
      pending: all.filter((g) => g.review_status === 'pending').length,
      declining: all.filter((g) => g.review_status === 'declining').length,
    }
  }, [gamesQuery.data])

  const filtered = (gamesQuery.data ?? []).filter((g) => {
    if (status !== 'all' && g.review_status !== status) return false
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

      {/* ── Status chips (Step 2: trend-radar review queue) ── */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Review status">
        {STATUS_FILTERS.map((s) => {
          const count = s.key === 'pending' ? reviewCounts.pending : s.key === 'declining' ? reviewCounts.declining : null
          const active = status === s.key
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(s.key)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                active
                  ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                  : 'border-border-default bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
              )}
            >
              {s.key !== 'all' && <Radar className="h-3.5 w-3.5" />}
              {s.label}
              {count !== null && (
                <span className={cn('rounded-full px-1.5 text-[11px] font-semibold', active ? 'bg-lime/20' : 'bg-bg-base text-text-tertiary')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        {status !== 'all' && filtered.length === 0 && !isLoading && (
          <span className="text-[13px] text-text-tertiary">Nothing {status} — the radar has no games waiting.</span>
        )}
      </div>

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
              {filter ? <>No games match &quot;{filter}&quot;</> : <>No {status === 'all' ? '' : `${status} `}games</>}
            </div>
          ) : (
            filtered.map((game) => {
              const badges = badgesByGame.get(game.id) ?? []
              const inReview = game.review_status === 'pending' || game.review_status === 'declining'
              const reviewOpen = inReview && openReview.has(game.slug)
              return (
                <React.Fragment key={game.id}>
                <div
                  id={game.slug}
                  className={cn(
                    'grid grid-cols-[60px_1.4fr_1.4fr_100px_110px_156px] items-center gap-3 border-b border-border-subtle px-5 py-4 text-sm transition-colors hover:bg-bg-base scroll-mt-24',
                    !game.is_active && !inReview && 'bg-red-500/[0.025]',
                    game.review_status === 'pending' && 'bg-lime/[0.03]',
                    reviewOpen && 'border-b-0'
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

                  {/* Name + slug + SEO index state */}
                  <div className={cn(!game.is_active && 'opacity-60')}>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-text-primary">{game.name}</span>
                      {game.seo_indexable === false ? (
                        <span
                          title="Forced noindex (SEO tab)"
                          className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning-bg px-1.5 py-0.5 text-[10px] font-bold text-warning"
                        >
                          <span className="h-1 w-1 rounded-full bg-warning" /> Noindex
                        </span>
                      ) : game.seo_indexable === true ? (
                        <span
                          title="Forced index (SEO tab)"
                          className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg px-1.5 py-0.5 text-[10px] font-bold text-lime-text"
                        >
                          <span className="h-1 w-1 rounded-full bg-lime" /> Index
                        </span>
                      ) : null}
                    </div>
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
                  <div className="flex flex-col items-start gap-1">
                    {game.review_status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg px-2 py-0.5 text-[12px] font-medium text-lime-text">
                        <Radar className="h-3 w-3" /> Pending Review
                      </span>
                    ) : game.review_status === 'declining' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning-bg px-2 py-0.5 text-[12px] font-medium text-warning">
                        <Radar className="h-3 w-3" /> Declining
                      </span>
                    ) : null}
                    {game.review_status !== 'pending' && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium',
                          game.is_active
                            ? 'bg-success-bg text-success'
                            : 'bg-red-500/15 text-red-400'
                        )}
                      >
                        {game.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {game.is_active ? 'Active' : game.review_status === 'rejected' ? 'Rejected' : 'Paused'}
                      </span>
                    )}
                  </div>

                  {/* V17l/V17s — Row actions: popular star, pause/resume,
                      edit, delete. The star flips games.is_popular so the
                      homepage Popular Games shelf surfaces this game. */}
                  <div className="flex items-center justify-end gap-0.5">
                    {inReview && (
                      <button
                        type="button"
                        onClick={() => toggleReview(game.slug)}
                        aria-expanded={reviewOpen}
                        className={cn(
                          'mr-1 inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[12px] font-medium transition-colors',
                          reviewOpen
                            ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                            : 'border-border-default text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                        )}
                      >
                        Review {reviewOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
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
                      onClick={() => spotlightMutation.mutate({ id: game.id, isSpotlight: !!game.is_spotlight })}
                      disabled={spotlightMutation.isPending}
                      title={game.is_spotlight ? 'Remove from mobile Spotlight grid' : 'Feature in mobile Spotlight grid'}
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50',
                        game.is_spotlight
                          ? 'text-lime hover:bg-lime-tint-bg'
                          : 'text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                      )}
                    >
                      <Sparkles
                        className={cn(
                          'h-3.5 w-3.5',
                          game.is_spotlight && 'fill-current',
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
                {reviewOpen && <TrendReviewCard gameId={game.id} slug={game.slug} />}
                </React.Fragment>
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
              will be cascaded to deleted state. There&apos;s no undo.
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
