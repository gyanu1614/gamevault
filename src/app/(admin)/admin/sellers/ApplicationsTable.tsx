'use client'

/**
 * /admin/sellers applications list (account-section design, 2026-09-30).
 *
 * One fill-only panel of store rows with hairlines: store image (initial
 * fallback), store name + applied time, country, the two ID checks (Didit
 * video, proof of address), up to three game icons (+N) that open the
 * games & categories dialog, and the status. Row click → detail page.
 * On phones a row is store + country/applied + status.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, HouseLine, VideoCamera, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AdminEmpty, StatusBadge, type ChipTone } from '../components/kit'
import { GameTile } from '../components/GameTile'
import { useNow } from '@/hooks/use-now'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import type { GameLookupEntry } from '@/lib/admin/seller-application-enrichment'
import { countryFlag } from '../_theme/flags'
import { calculateVerificationStatus } from '@/lib/utils/seller-verification'
import { forestStatusChip } from '../_theme/forest'

interface ApplicationsTableProps {
  applications: SellerApplication[]
}

/**
 * "applied 2 hours ago" / "applied Jul 15" style relative label.
 * Gated on the useNow() clock: nowMs is null during SSR + hydration so both
 * renders emit '' — new Date() here during render made the server HTML and
 * the hydration render disagree ("just now" vs "1m ago") and bailed the
 * whole admin root out to client rendering.
 */
function appliedLabel(date: string, nowMs: number | null): string {
  if (nowMs == null) return ''
  const d = new Date(date)
  const now = new Date(nowMs)
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days === 0) {
    if (hours === 0) {
      if (minutes <= 0) return 'applied just now'
      return `applied ${minutes}m ago`
    }
    return `applied ${hours}h ago`
  }
  if (days < 7) return `applied ${days}d ago`

  return `applied ${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })}`
}

interface GameTileData {
  key: string
  name: string
  image: string | null
  /** Category sections applied for this game (labels, Title Case). */
  cats: string[]
}


/** Wizard category sections → display labels (for the games popup). */
const CAT_LABELS: Record<string, string> = {
  items: 'Items',
  accounts: 'Accounts',
  currency: 'Currency',
  'top-up': 'Top-Up',
  boosting: 'Boosting',
}

/**
 * Ordered, de-duplicated game tiles for a row: games_categories entries
 * resolved through the real-games lookup first; legacy rows fall back to
 * primary_games (+ resolved game_names for the initial/gradient).
 */
function rowGameTiles(app: SellerApplication): GameTileData[] {
  const lookup = app.games_lookup || {}
  const seen = new Set<string>()
  const tiles: GameTileData[] = []

  const push = (entry: GameLookupEntry | undefined, fallbackName: string, cats: string[] = []) => {
    const key = entry?.id ?? fallbackName
    if (!key || seen.has(key)) return
    seen.add(key)
    tiles.push({
      key,
      name: entry?.name ?? fallbackName,
      image: entry?.image_url ?? null,
      cats,
    })
  }

  if (app.games_categories && app.games_categories.length > 0) {
    for (const gc of app.games_categories) {
      push(
        lookup[gc.gameId] ?? lookup[gc.gameSlug],
        gc.gameSlug,
        (gc.categorySlugs || []).map((c) => CAT_LABELS[c] ?? c),
      )
    }
  } else {
    ;(app.primary_games || []).forEach((id, index) => {
      push(lookup[String(id)], app.game_names?.[index] ?? String(id))
    })
  }

  return tiles
}

const STATUS_TONE: Record<string, ChipTone> = {
  pending: 'warning',
  under_review: 'warning',
  info_requested: 'info',
  approved: 'success',
  rejected: 'error',
  withdrawn: 'neutral',
}

function RowStatusChip({ app }: { app: SellerApplication }) {
  // Approved sellers who were later restricted/banned surface that state
  // instead of the stale application status (view flattens seller_status).
  const sellerStatus = app.seller_status || app.user?.seller_status
  if (app.status === 'approved' && sellerStatus === 'restricted') return <StatusBadge status="Restricted" tone="warning" />
  if (app.status === 'approved' && sellerStatus === 'banned') return <StatusBadge status="Banned" tone="error" />
  const chip = forestStatusChip(app.status)
  return <StatusBadge status={chip.label} tone={STATUS_TONE[app.status] ?? 'neutral'} />
}

/** A game icon (or its initial) in the row's stack. */
function GameIcon({ tile, size = 'h-8 w-8' }: { tile: GameTileData; size?: string }) {
  return <GameTile src={tile.image} name={tile.name} className={cn(size, 'text-[12px]')} />
}

export default function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const router = useRouter()
  const now = useNow()
  /** Which application's games popup is open (null = closed). */
  const [gamesApp, setGamesApp] = useState<SellerApplication | null>(null)

  if (applications.length === 0) {
    return <AdminEmpty icon={FileText} title="No applications found" hint="New seller applications will appear here." />
  }

  const open = (id: string) => router.push(`/admin/sellers/${id}`)

  return (
    <>
      <div className="overflow-hidden rounded-lg bg-bg-raised">
        {/* Column headers (md+) */}
        <div className="hidden items-center gap-4 border-b border-white/[0.06] px-4 py-3 text-[12px] font-medium text-text-tertiary md:flex">
          <span className="min-w-0 flex-1 pl-[54px]">Store</span>
          <span className="w-40 shrink-0">Country</span>
          <span className="hidden w-[76px] shrink-0 lg:block">ID Checks</span>
          <span className="w-[148px] shrink-0">Games</span>
          <span className="w-[150px] shrink-0 text-right">Status</span>
        </div>

        <ul className="divide-y divide-white/[0.06]">
          {applications.map((app) => {
            const storeName = app.shop_name || app.display_name || 'Unnamed Store'
            const storeImage = app.store_image_url || app.user?.avatar_url || null
            const flag = countryFlag(app.country)
            const tiles = rowGameTiles(app)
            const verification = calculateVerificationStatus(app.documents, app)
            const idCheck = verification.checks.find((c) => c.key === 'identity')
            const addrCheck = verification.checks.find((c) => c.key === 'address')
            const applied = appliedLabel(app.created_at, now)

            return (
              <li
                key={app.id}
                role="link"
                tabIndex={0}
                onClick={() => open(app.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open(app.id)
                  }
                }}
                className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none"
              >
                {/* Store */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <GameTile src={storeImage} name={storeName} className="h-[42px] w-[42px] rounded-md text-[15px]" />
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-text-primary">{storeName}</p>
                    <p className="truncate text-[12.5px] text-text-tertiary">
                      <span className="md:hidden">
                        {flag && <span className="mr-1">{flag}</span>}
                        {app.country || '—'}
                        {applied && ' · '}
                      </span>
                      {applied}
                    </p>
                  </div>
                </div>

                {/* Country */}
                <div className="hidden w-40 shrink-0 items-center gap-2 md:flex">
                  {flag && <span className="text-[18px] leading-none">{flag}</span>}
                  <span className="truncate text-[13px] text-text-secondary">{app.country || '—'}</span>
                </div>

                {/* ID Checks — Didit video + proof of address */}
                <div className="hidden w-[76px] shrink-0 items-center gap-1.5 lg:flex">
                  <IdCheck
                    ok={idCheck?.ok ?? false}
                    label={idCheck?.ok ? (idCheck.viaDidit ? 'Didit Video Verified' : 'ID Verified (Documents)') : 'Identity Not Verified'}
                    icon={VideoCamera}
                  />
                  <IdCheck
                    ok={addrCheck?.ok ?? false}
                    label={addrCheck?.ok ? 'Proof Of Address Uploaded' : 'Proof Of Address Missing'}
                    icon={HouseLine}
                  />
                </div>

                {/* Games — opens the games & categories dialog */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setGamesApp(app)
                  }}
                  className="hidden w-[148px] shrink-0 items-center gap-1 rounded-md p-1 transition-colors hover:bg-white/[0.06] sm:flex"
                  aria-label={`${storeName}: games and categories`}
                >
                  {tiles.slice(0, 3).map((tile) => (
                    <GameIcon key={tile.key} tile={tile} />
                  ))}
                  {tiles.length > 3 && (
                    <span className="grid h-8 min-w-8 place-items-center rounded-md bg-white/[0.08] px-1.5 text-[11px] font-bold text-text-secondary">
                      +{tiles.length - 3}
                    </span>
                  )}
                  {tiles.length === 0 && <span className="text-[12px] text-text-disabled">—</span>}
                </button>

                {/* Status */}
                <div className="flex shrink-0 justify-end md:w-[150px]">
                  <RowStatusChip app={app} />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <Dialog open={!!gamesApp} onOpenChange={(o) => !o && setGamesApp(null)}>
        <DialogContent className="max-w-[440px] border-0 p-5 sm:p-6">
          {gamesApp && <GamesList app={gamesApp} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Lit/dim ID-check tile with a tooltip. */
function IdCheck({ ok, label, icon: Icon }: { ok: boolean; label: string; icon: PhosphorIcon }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-md',
            ok ? 'bg-success-bg text-success' : 'bg-white/[0.05] text-text-disabled',
          )}
        >
          <Icon aria-hidden weight={ok ? 'fill' : 'bold'} className="h-4 w-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="border-0 bg-bg-overlay-2 text-[12px]">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Games & Categories list inside the dialog. */
function GamesList({ app }: { app: SellerApplication }) {
  const tiles = rowGameTiles(app)
  return (
    <>
      <div className="pr-8">
        <DialogTitle className="text-[17px] font-bold">{app.shop_name || app.display_name || 'Store'}</DialogTitle>
        <DialogDescription className="mt-1">Games and categories applied for</DialogDescription>
      </div>
      <div className="-mx-1 max-h-[55vh] divide-y divide-white/[0.06] overflow-y-auto px-1">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex items-center gap-3 py-3 first:pt-0">
            <GameIcon tile={tile} size="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-text-primary">{tile.name}</p>
              {tile.cats.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tile.cats.map((cat) => (
                    <span key={cat} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {app.other_games && (
          <div className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-warning-bg text-[14px] font-bold text-warning">+</span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-text-primary">Other Games</p>
              <p className="mt-0.5 text-[12.5px] italic text-text-tertiary">“{app.other_games}”</p>
            </div>
          </div>
        )}
        {tiles.length === 0 && !app.other_games && <p className="py-3 text-[13px] text-text-tertiary">No games listed.</p>}
      </div>
    </>
  )
}
