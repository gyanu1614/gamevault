'use client'

/**
 * /admin/games — every game with its enabled categories, listing count,
 * review / live state and row actions (popular, spotlight, pause, edit,
 * delete). Trend-radar games (pending | declining) open a review card
 * under their row.
 *
 * One responsive row: a card below xl, a table row from xl.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CaretDown, GameController, MagnifyingGlass, Pause, PencilSimple, Play, Sparkle, Star, Trash, X,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { fetchAdminGames, toggleGameActive, deleteGame, toggleGamePopular, toggleGameSpotlight } from '@/lib/actions/admin-games'
import {
  fetchAdminGameCategoryBadges,
  type AdminGameCategoryBadge,
} from '@/lib/actions/admin-game-categories'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AdminEmpty, AdminLoadingRows, PageHeader, StatusBadge, adminBtn, adminFieldCls } from '../../components/kit'
import { GameTile } from '../../components/GameTile'
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

/** Square icon button for row actions; `on` = the flag is set. */
function IconAction({
  label, onClick, disabled, on, danger, children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  on?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-50',
        danger
          ? 'text-text-secondary hover:bg-error-bg hover:text-error'
          : on
            ? 'bg-white/[0.06] text-lime-text hover:bg-white/[0.10]'
            : 'text-text-secondary hover:bg-white/[0.08] hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

const ROW_GRID = 'xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_64px_132px_188px] xl:items-center xl:gap-4'

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
  // the tab comes from the query string, the open card from the hash.
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
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Games"
        description={gamesQuery.data ? `${activeCount} active · ${gamesQuery.data.length} total` : 'Loading…'}
        className="mb-0 sm:mb-0"
        actions={<AddGameDialog />}
      />

      {/* Review tabs (Step 2: trend-radar queue) + filter */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs<StatusFilter>
          tabs={[
            { id: 'all', label: 'All Games' },
            { id: 'pending', label: <>Pending Review <TabCount n={reviewCounts.pending} /></> },
            { id: 'declining', label: <>Declining <TabCount n={reviewCounts.declining} /></> },
          ]}
          value={status}
          onChange={setStatus}
          layoutId="games-status"
          ariaLabel="Review status"
        />
        <div className="relative w-full lg:max-w-[320px]">
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter games"
            placeholder="Filter by name or slug…"
            className={cn(adminFieldCls, 'pl-10 pr-9')}
          />
          {filter && (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            >
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div role="tabpanel" id={`games-status-panel-${status}`} aria-labelledby={`games-status-tab-${status}`}>
        {isLoading ? (
          <AdminLoadingRows rows={8} />
        ) : filtered.length === 0 ? (
          <AdminEmpty
            icon={GameController}
            title={filter ? 'No Matching Games' : status === 'all' ? 'No Games Yet' : `Nothing ${status === 'pending' ? 'Pending' : 'Declining'}`}
            hint={
              filter
                ? `No games match "${filter}".`
                : status === 'all'
                  ? 'Add a game to get started.'
                  : 'The trend radar has no games waiting.'
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg bg-bg-raised">
            {/* Column headings (lg+) */}
            <div className={cn('hidden border-b border-white/[0.06] px-4 py-3 text-[12px] font-medium text-text-tertiary xl:grid', ROW_GRID)}>
              <span>Game</span>
              <span>Categories Enabled</span>
              <span>Listings</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {filtered.map((game) => {
                const badges = badgesByGame.get(game.id) ?? []
                const inReview = game.review_status === 'pending' || game.review_status === 'declining'
                const reviewOpen = inReview && openReview.has(game.slug)
                const muted = !game.is_active && !inReview

                const statusBadges = (
                  <div className="flex flex-wrap items-center gap-1.5 xl:flex-col xl:items-start xl:gap-1">
                    {game.review_status === 'pending' ? (
                      <StatusBadge status="Pending Review" tone="lime" />
                    ) : game.review_status === 'declining' ? (
                      <StatusBadge status="Declining" tone="warning" />
                    ) : null}
                    {game.review_status !== 'pending' && (
                      <StatusBadge
                        status={game.is_active ? 'Active' : game.review_status === 'rejected' ? 'Rejected' : 'Paused'}
                        tone={game.is_active ? 'success' : 'error'}
                      />
                    )}
                  </div>
                )

                // Below xl it sits with the row actions; from xl under the status
                // badge, so the fixed-width Actions column lines up on every row.
                const reviewButton = inReview ? (
                  <button
                    type="button"
                    onClick={() => toggleReview(game.slug)}
                    aria-expanded={reviewOpen}
                    className={cn(
                      'inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-semibold transition-colors xl:h-8',
                      reviewOpen ? 'bg-white/[0.10] text-text-primary' : 'bg-white/[0.06] text-text-secondary hover:bg-white/[0.10] hover:text-text-primary',
                    )}
                  >
                    Review
                    <CaretDown aria-hidden weight="bold" className={cn('h-3.5 w-3.5 transition-transform', reviewOpen && 'rotate-180')} />
                  </button>
                ) : null

                return (
                  <div key={game.id} id={game.slug} className="scroll-mt-24">
                    <div className={cn('px-4 py-3.5 transition-colors hover:bg-white/[0.02]', ROW_GRID)}>
                      {/* Game */}
                      <div className="flex min-w-0 items-center gap-3 xl:order-1">
                        <GameTile src={game.image_url} name={game.name} className={cn('h-10 w-10', muted && 'opacity-60')} />
                        <div className={cn('min-w-0 flex-1', muted && 'opacity-60')}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[14px] font-semibold text-text-primary">{game.name}</span>
                            {game.seo_indexable === false ? (
                              <span title="Forced noindex (SEO tab)" className="shrink-0 rounded-full bg-warning-bg px-1.5 py-px text-[11px] font-semibold text-warning">
                                Noindex
                              </span>
                            ) : game.seo_indexable === true ? (
                              <span title="Forced index (SEO tab)" className="shrink-0 rounded-full bg-lime-tint-bg px-1.5 py-px text-[11px] font-semibold text-lime-text">
                                Index
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-[12px] text-text-tertiary">
                            <span className="font-mono">{game.slug}</span>
                            <span className="tabular-nums xl:hidden">
                              {' · '}{game.listing_count ?? 0} listing{game.listing_count === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 xl:hidden">{statusBadges}</div>
                      </div>

                      {/* Listings (xl) */}
                      <div className={cn('hidden text-[13px] font-semibold tabular-nums text-text-secondary xl:order-3 xl:block', muted && 'opacity-60')}>
                        {game.listing_count ?? 0}
                      </div>

                      {/* Status (xl) */}
                      <div className="hidden xl:order-4 xl:flex xl:flex-col xl:items-start xl:gap-1.5">
                        {statusBadges}
                        {reviewButton}
                      </div>

                      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4 xl:contents">
                        {/* Category badges — one sideways-scrolling row on phones */}
                        <div className="-mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-1 sm:px-0 xl:order-2 xl:flex-wrap xl:overflow-visible [&::-webkit-scrollbar]:hidden">
                          {badges.length === 0 ? (
                            <span className="text-[12.5px] text-text-disabled">None enabled</span>
                          ) : (
                            badges.map((b) => (
                              <span
                                key={b.game_category_id}
                                title={!b.is_active_global ? `${b.category_name} (disabled at launch)` : b.category_name}
                                className={cn(
                                  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium',
                                  b.is_active_global ? 'bg-white/[0.06] text-text-secondary' : 'bg-warning-bg text-warning',
                                )}
                              >
                                {b.icon_emoji && <span aria-hidden>{b.icon_emoji}</span>}
                                {b.category_name}
                              </span>
                            ))
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex shrink-0 items-center justify-end xl:order-5">
                          <div className="flex items-center gap-0.5">
                            {reviewButton && <div className="mr-1 xl:hidden">{reviewButton}</div>}
                            <IconAction
                              label={game.is_popular ? 'Remove from Popular Games' : 'Mark as popular'}
                              on={!!game.is_popular}
                              disabled={popularMutation.isPending}
                              onClick={() => popularMutation.mutate({ id: game.id, isPopular: !!game.is_popular })}
                            >
                              <Star aria-hidden weight={game.is_popular ? 'fill' : 'bold'} className="h-4 w-4" />
                            </IconAction>
                            <IconAction
                              label={game.is_spotlight ? 'Remove from mobile Spotlight grid' : 'Feature in mobile Spotlight grid'}
                              on={!!game.is_spotlight}
                              disabled={spotlightMutation.isPending}
                              onClick={() => spotlightMutation.mutate({ id: game.id, isSpotlight: !!game.is_spotlight })}
                            >
                              <Sparkle aria-hidden weight={game.is_spotlight ? 'fill' : 'bold'} className="h-4 w-4" />
                            </IconAction>
                            <IconAction
                              label={game.is_active ? 'Pause' : 'Activate'}
                              disabled={toggleMutation.isPending}
                              onClick={() => toggleMutation.mutate({ id: game.id, isActive: game.is_active })}
                            >
                              {game.is_active ? (
                                <Pause aria-hidden weight="bold" className="h-4 w-4" />
                              ) : (
                                <Play aria-hidden weight="bold" className="h-4 w-4" />
                              )}
                            </IconAction>
                            <Link
                              href={`/admin/games/${game.id}/edit`}
                              aria-label={`Edit ${game.name}`}
                              title="Edit"
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                            >
                              <PencilSimple aria-hidden weight="bold" className="h-4 w-4" />
                            </Link>
                            <IconAction label="Delete" danger onClick={() => setPendingDelete(game)}>
                              <Trash aria-hidden weight="bold" className="h-4 w-4" />
                            </IconAction>
                          </div>
                        </div>
                      </div>
                    </div>
                    {reviewOpen && <TrendReviewCard gameId={game.id} slug={game.slug} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          Active games are visible in the marketplace
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warning" />
          Amber categories are disabled globally at launch (Boosting)
        </span>
      </div>

      {/* V17l — Delete confirmation. Two-step pattern so admins don't
          drop a game with a single mis-click; the action cascades to
          listings via FK so it's not reversible. */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              This permanently removes the game and unlinks its categories. Active listings
              will be cascaded to deleted state. There&apos;s no undo.
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setPendingDelete(null)} className={adminBtn.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              disabled={deleteMutation.isPending}
              className={adminBtn.danger}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Game'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
