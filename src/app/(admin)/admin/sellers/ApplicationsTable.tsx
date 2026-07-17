'use client'

/**
 * Forest Ledger — /admin/sellers applications list rows (approved mockup ②).
 *
 * Store-first forest-glass rows on the canvas: store image tile leads,
 * shop name bold with the applicant sub-line (display name · type ·
 * country · applied relative time), stacked REAL game logos (max 3 +
 * overflow +N), an honest verification mini-bar (applicable checks
 * only), and the status chip. Row click → detail page.
 *
 * Motion: CSS-only staggered fade-up (no framer-motion).
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import type { GameLookupEntry } from '@/lib/admin/seller-application-enrichment'
import { countryFlag } from '../_theme/flags'
import { calculateVerificationStatus } from '@/lib/utils/seller-verification'
import { SELLER_TYPE_LABELS } from '@/lib/seller-application/labels'
import { IconDiditVideo, IconAddressProof } from '../_theme/SectionIcons'
import {
  FOREST_BG,
  FOREST_MOTION,
  forestStagger,
  forestStatusChip,
  gameTileGradient,
} from '../_theme/forest'

interface ApplicationsTableProps {
  applications: SellerApplication[]
}

/** "applied 2 hours ago" / "applied Jul 15" style relative label. */
function appliedLabel(date: string): string {
  const d = new Date(date)
  const now = new Date()
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

interface GameTile {
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
function rowGameTiles(app: SellerApplication): GameTile[] {
  const lookup = app.games_lookup || {}
  const seen = new Set<string>()
  const tiles: GameTile[] = []

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

const ROW_CHIP =
  'inline-flex shrink-0 items-center rounded-full px-[11px] py-1 text-[11.5px] font-bold'

function RowStatusChip({ app }: { app: SellerApplication }) {
  // Approved sellers who were later restricted/banned surface that state
  // instead of the stale application status (view flattens seller_status).
  const sellerStatus = app.seller_status || app.user?.seller_status
  if (app.status === 'approved' && sellerStatus === 'restricted') {
    return (
      <span className={cn(ROW_CHIP, 'bg-[#F59E0B]/[0.16] text-[#FCD34D]')}>Restricted</span>
    )
  }
  if (app.status === 'approved' && sellerStatus === 'banned') {
    return <span className={cn(ROW_CHIP, 'bg-[#B42318]/20 text-[#FCA5A5]')}>Banned</span>
  }

  const chip = forestStatusChip(app.status)
  return <span className={chip.onDark}>{chip.label}</span>
}

export default function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const router = useRouter()
  /** Which application's games popup is open (null = closed). */
  const [gamesApp, setGamesApp] = useState<SellerApplication | null>(null)

  if (applications.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-white/25" />
        <p className="text-[15px] font-bold text-white/90">No Applications Found</p>
        <p className="mt-1 text-[12.5px] text-white/50">
          New seller applications will appear here
        </p>
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-col gap-2">
      {/* Column headers (desktop) */}
      <div className="hidden items-center gap-3.5 px-4 pb-1 md:flex">
        <span className="w-[42px] shrink-0" />
        <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
          Store
        </span>
        <span className="w-36 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
          Country
        </span>
        <span className="hidden w-[84px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 lg:block">
          ID Checks
        </span>
        <span className="w-[150px] shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
          Games
        </span>
        <span className="w-[118px] shrink-0 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
          Status
        </span>
      </div>
      {applications.map((app, index) => {
        const storeName = app.shop_name || app.display_name || 'Unnamed Store'
        const storeInitial = (storeName.trim()[0] || 'S').toUpperCase()
        const storeImage = app.store_image_url || app.user?.avatar_url || null

        const flag = countryFlag(app.country)

        const tiles = rowGameTiles(app)
        const verification = calculateVerificationStatus(app.documents, app)
        const idCheck = verification.checks.find((c) => c.key === 'identity')
        const addrCheck = verification.checks.find((c) => c.key === 'address')

        return (
          <div
            key={app.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/admin/sellers/${app.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(`/admin/sellers/${app.id}`)
              }
            }}
            className={cn(
              'flex cursor-pointer items-center gap-3.5 rounded-[14px] border border-white/[0.09] bg-white/[0.05] px-4 py-3 backdrop-blur-sm',
              'transition-[transform,box-shadow,background-color,border-color] duration-150 hover:-translate-y-[1px]',
              'hover:border-white/[0.14] hover:bg-white/[0.08]',
              'hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3E635]',
              FOREST_MOTION.fadeUp,
            )}
            style={forestStagger(Math.min(index, 10), 45)}
          >
            {/* Store image tile (submitted store image; initial tile fallback) */}
            {storeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeImage}
                alt={storeName}
                className="h-[42px] w-[42px] shrink-0 rounded-[10px] object-cover"
              />
            ) : (
              <div
                className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-[#A3E635]"
                style={{ background: FOREST_BG.storeTile }}
              >
                {storeInitial}
              </div>
            )}

            {/* Store — logo + name only */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold text-white/95">{storeName}</p>
            </div>

            {/* Country */}
            <div className="hidden w-36 shrink-0 items-center gap-1.5 md:flex">
              {flag && <span className="text-[15px] leading-none">{flag}</span>}
              <span className="truncate text-[12px] text-white/70">{app.country || '—'}</span>
            </div>

            {/* ID Checks — Didit video + proof of address */}
            <div className="hidden w-[84px] shrink-0 items-center gap-1.5 lg:flex">
              <IdCheck
                ok={idCheck?.ok ?? false}
                label={
                  idCheck?.ok
                    ? idCheck.viaDidit
                      ? 'Didit Video Verified'
                      : 'ID Verified (Documents)'
                    : 'Identity Not Verified'
                }
              >
                <IconDiditVideo size={18} />
              </IdCheck>
              <IdCheck
                ok={addrCheck?.ok ?? false}
                label={addrCheck?.ok ? 'Proof Of Address Uploaded' : 'Proof Of Address Missing'}
              >
                <IconAddressProof size={18} />
              </IdCheck>
            </div>

            {/* Games — click opens the games & categories popup */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setGamesApp(app)
              }}
              className="hidden w-[150px] shrink-0 items-center gap-1.5 rounded-[10px] px-1 py-1 transition-colors hover:bg-white/[0.06] sm:flex"
              aria-label="View games and categories"
            >
                {tiles.slice(0, 3).map((tile) => (
                  <div key={tile.key} className="group relative">
                    {/* Instant tooltip — native title takes ~1s to appear */}
                    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#0A1810] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-xl ring-1 ring-white/15 transition-opacity duration-75 group-hover:opacity-100">
                      {tile.name}
                    </span>
                    {tile.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tile.image}
                        alt={tile.name}
                        className="h-9 w-9 rounded-[10px] object-cover shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-all duration-150 group-hover:scale-110 group-hover:ring-[#A3E635]/50"
                      />
                    ) : (
                      <div
                        className="grid h-9 w-9 place-items-center rounded-[10px] text-[12px] font-black text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-all duration-150 group-hover:scale-110 group-hover:ring-[#A3E635]/50"
                        style={{ background: gameTileGradient(tile.name) }}
                      >
                        {(tile.name.trim()[0] || '?').toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {tiles.length > 3 && (
                  <div className="grid h-9 min-w-9 place-items-center rounded-[10px] bg-white/[0.12] px-1.5 text-[10px] font-black text-white/70 ring-1 ring-white/10">
                    +{tiles.length - 3}
                  </div>
                )}
                {tiles.length === 0 && (
                  <span className="text-[11px] text-white/35">—</span>
                )}
            </button>

            {/* Status + applied */}
            <div className="ml-auto flex w-auto shrink-0 flex-col items-end gap-1 md:ml-0 md:w-[118px]">
              <RowStatusChip app={app} />
              <span className="text-[10px] text-white/35">{appliedLabel(app.created_at)}</span>
            </div>
          </div>
        )
      })}
    </div>

    {gamesApp && <GamesPopup app={gamesApp} onClose={() => setGamesApp(null)} />}
    </>
  )
}

/** Small lit/dim ID-check chip with an instant tooltip. */
function IdCheck({
  ok,
  label,
  children,
}: {
  ok: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <span className="group relative">
      <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#0A1810] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-xl ring-1 ring-white/15 transition-opacity duration-75 group-hover:opacity-100">
        {label}
      </span>
      <span
        className={cn(
          'grid h-[30px] w-[30px] place-items-center rounded-[9px] transition-colors',
          ok ? 'bg-[#A3E635]/15' : 'bg-white/[0.06] opacity-35 grayscale',
        )}
      >
        {children}
      </span>
    </span>
  )
}

/** Games & Categories popup for a list row. */
function GamesPopup({ app, onClose }: { app: SellerApplication; onClose: () => void }) {
  const tiles = rowGameTiles(app)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 cursor-default bg-[#0A1810]/70 backdrop-blur-sm"
      />
      <div className="animate-fade-up relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0F2419]/95 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-extrabold text-white/95">
              {app.shop_name || app.display_name || 'Store'}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-white/45">Games & Categories applied for</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {tiles.map((tile, i) => (
            <div
              key={tile.key}
              className={cn(
                'flex items-center gap-3 py-3',
                i > 0 && 'border-t border-white/[0.08]',
              )}
            >
              {tile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.image}
                  alt={tile.name}
                  className="h-9 w-9 shrink-0 rounded-[10px] object-cover ring-1 ring-white/10"
                />
              ) : (
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-black text-white ring-1 ring-white/10"
                  style={{ background: gameTileGradient(tile.name) }}
                >
                  {(tile.name.trim()[0] || '?').toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white/90">{tile.name}</p>
                {tile.cats.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tile.cats.map((cat) => (
                      <span
                        key={cat}
                        className="rounded-md bg-white/[0.08] px-2 py-[2px] text-[10px] font-bold text-white/80"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {app.other_games && (
            <div className={cn('flex items-center gap-3 py-3', tiles.length > 0 && 'border-t border-white/[0.08]')}>
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-black text-white ring-1 ring-white/10"
                style={{ background: 'linear-gradient(140deg, #F59E0B, #B45309)' }}
              >
                +
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white/90">Other Games</p>
                <p className="mt-0.5 text-[11.5px] italic text-white/50">“{app.other_games}”</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
