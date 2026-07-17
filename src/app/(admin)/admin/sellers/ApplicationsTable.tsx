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

import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import type { GameLookupEntry } from '@/lib/admin/seller-application-enrichment'
import { countryFlag } from '../_theme/flags'
import { calculateVerificationStatus } from '@/lib/utils/seller-verification'
import { SELLER_TYPE_LABELS } from '@/lib/seller-application/labels'
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

  const push = (entry: GameLookupEntry | undefined, fallbackName: string) => {
    const key = entry?.id ?? fallbackName
    if (!key || seen.has(key)) return
    seen.add(key)
    tiles.push({
      key,
      name: entry?.name ?? fallbackName,
      image: entry?.image_url ?? null,
    })
  }

  if (app.games_categories && app.games_categories.length > 0) {
    for (const gc of app.games_categories) {
      push(lookup[gc.gameId] ?? lookup[gc.gameSlug], gc.gameSlug)
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
    <div className="flex flex-col gap-2">
      {applications.map((app, index) => {
        const storeName = app.shop_name || app.display_name || 'Unnamed Store'
        const storeInitial = (storeName.trim()[0] || 'S').toUpperCase()
        const storeImage = app.store_image_url || app.user?.avatar_url || null

        const subParts = [
          app.display_name || app.user?.username,
          SELLER_TYPE_LABELS[app.seller_type ?? ''] ?? app.seller_type,
          appliedLabel(app.created_at),
        ].filter(Boolean)
        const flag = countryFlag(app.country)

        const tiles = rowGameTiles(app)
        const verification = calculateVerificationStatus(app.documents, app)

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

            {/* Store name + applicant + contact lines */}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold text-white/95">{storeName}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-white/45">
                {subParts.join(' · ')}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-white/60">
                {app.user?.email && (
                  <>
                    <span className="text-white/35">Email:</span> {app.user.email}
                  </>
                )}
                {app.country && (
                  <>
                    {app.user?.email && <span className="text-white/25"> · </span>}
                    <span className="text-white/35">Country:</span> {flag ? `${flag} ` : ''}
                    {app.country}
                  </>
                )}
              </p>
            </div>

            {/* Stacked game logos (max 3 + overflow) */}
            {tiles.length > 0 && (
              <div className="ml-2 hidden shrink-0 items-center gap-1.5 sm:flex">
                {tiles.slice(0, 4).map((tile) =>
                  tile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={tile.key}
                      src={tile.image}
                      alt={tile.name}
                      title={tile.name}
                      className="h-8 w-8 rounded-[9px] object-cover ring-1 ring-white/15"
                    />
                  ) : (
                    <div
                      key={tile.key}
                      title={tile.name}
                      className="grid h-8 w-8 place-items-center rounded-[9px] text-[11px] font-black text-white ring-1 ring-white/15"
                      style={{ background: gameTileGradient(tile.name) }}
                    >
                      {(tile.name.trim()[0] || '?').toUpperCase()}
                    </div>
                  ),
                )}
                {tiles.length > 4 && (
                  <div className="grid h-8 min-w-8 place-items-center rounded-[9px] bg-white/[0.12] px-1.5 text-[10px] font-black text-white/70 ring-1 ring-white/15">
                    +{tiles.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Verification mini-bar — applicable checks only */}
            <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
              <span className="h-[5px] w-[74px] overflow-hidden rounded-full bg-white/[0.12]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#65A30D] to-[#A3E635]"
                  style={{ width: `${verification.percentage}%` }}
                />
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-white/60">
                {verification.verified}/{verification.total}
              </span>
            </div>

            {/* ml-auto only matters below md, where the meter (the usual
                spacer) is hidden. */}
            <div className="ml-auto shrink-0 md:ml-0">
              <RowStatusChip app={app} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
