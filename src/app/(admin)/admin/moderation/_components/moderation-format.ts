import { listingOwnerUrl } from '@/lib/listings/url'
import type {
  ModerationHistorySlice,
  SellerModerationContext,
} from '@/lib/actions/moderation'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Tab = 'pending' | 'awaiting' | 'history'

export interface SellerGroup {
  sellerId: string
  seller: any
  context: SellerModerationContext | null
  listings: any[]
}

export interface QueueData {
  listings: any[]
  stats: any
}

export type StatKey = 'pending' | 'awaiting_seller' | 'approved_today' | 'rejected_today' | 'total_approved'

export const APPROVED_TILES: StatKey[] = ['approved_today', 'total_approved']

/** The number a queued listing is counted under. */
export function tileOf(listing: any): StatKey {
  return listing.status === 'changes_requested' ? 'awaiting_seller' : 'pending'
}

export function moveStats(stats: QueueData['stats'], changes: Partial<Record<StatKey, number>>): QueueData['stats'] {
  if (!stats) return stats
  const next = { ...stats }
  for (const [tile, change] of Object.entries(changes)) {
    next[tile] = Math.max(0, (next[tile] ?? 0) + (change ?? 0))
  }
  return next
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Relative label gated on the useNow() clock — `now` is null during SSR +
 * hydration, so both renders emit '' and the real label fills in after
 * mount (Date.now() in render caused a hydration mismatch → inert page).
 */
export function relativeTime(iso: string | null | undefined, now: number | null): string {
  if (!iso || now == null) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function isOlderThan24h(iso: string | null | undefined, now: number | null): boolean {
  if (!iso || now == null) return false
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return false
  return now - then > 24 * 60 * 60 * 1000
}

/** UTC-pinned so server and client format the identical string. */
export function joinedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Joined ${d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })}`
}

/** Up to 3 short template_data key:value chips (long/object values skipped). */
export function templateChips(td: unknown): { k: string; v: string }[] {
  if (!td || typeof td !== 'object' || Array.isArray(td)) return []
  const out: { k: string; v: string }[] = []
  for (const [k, v] of Object.entries(td as Record<string, unknown>)) {
    if (out.length >= 3) break
    if (v == null || typeof v === 'object') continue
    const s = String(v).trim()
    if (!s || s.length > 24) continue
    out.push({ k: k.replace(/[_-]/g, ' '), v: s })
  }
  return out
}

/** The listing as admins see it: its live page, or the preview route while it
 *  is not live (the public listing page serves active listings only). */
export function previewHref(listing: any): string | null {
  return listing?.id ? listingOwnerUrl(listing) : null
}

export const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`

// ─── Shared class snippets ───────────────────────────────────────────────────

/** Small fill chip in a seller group's header. */
export const CHIP = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

export const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

export const HISTORY_SLICES: { key: ModerationHistorySlice; label: string }[] = [
  { key: 'approved_today', label: 'Approved Today' },
  { key: 'rejected_today', label: 'Rejected Today' },
  { key: 'approved_all', label: 'All Approved' },
  { key: 'all', label: 'Everything' },
]
