/**
 * What a buyer-facing surface says about a seller (owner, 2026-09-29).
 *
 *   · no sales yet → "Verified Seller" — or "New Seller" when the seller has
 *     not verified their identity yet (open seller signup, 2026-10-08: sellers
 *     list first and verify at their first withdrawal; profiles.is_verified).
 *   · otherwise → positive rating with its review count (from the first
 *     review; never a made-up score), total sold, and the tier by name
 *     ("Gold"; tier logos come later).
 *
 * Rendered by <SellerStats> (src/components/seller/SellerStats.tsx) on
 * listing cards, the listing page, both currency pages, the shop banner,
 * checkout and the order page, so they cannot drift apart.
 */
import { tierByKey } from './tiers'

export interface SellerStatInput {
  /** Positive-feedback % (0–100), or null with no reviews. */
  ratingPercent: number | null | undefined
  reviews: number | null | undefined
  sales: number | null | undefined
  tier?: string | null
  /** profiles.is_verified. Omitted = verified (older callers). */
  verified?: boolean | null
}

export type SellerStatLine =
  | { kind: 'verified' }
  | { kind: 'new' }
  | {
      kind: 'stats'
      /** Present only when there is at least one review. */
      rating: { percent: string; reviews: number } | null
      sales: number
      tierLabel: string
      tierClass: string
    }

const n = (v: number | null | undefined) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0)

/** "100" / "99.5": whole numbers stay whole. */
export function fmtPercent(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1)
}

export function sellerStatLine(s: SellerStatInput): SellerStatLine {
  const sales = n(s.sales)
  const reviews = n(s.reviews)
  if (sales === 0 && reviews === 0) return s.verified === false ? { kind: 'new' } : { kind: 'verified' }
  const tier = tierByKey(s.tier)
  return {
    kind: 'stats',
    rating: s.ratingPercent != null && reviews > 0 ? { percent: fmtPercent(s.ratingPercent), reviews } : null,
    sales,
    tierLabel: tier.label,
    tierClass: tier.colors.text,
  }
}

/** Plain-text version for aria-labels and tests. */
export function sellerStatText(s: SellerStatInput): string {
  const line = sellerStatLine(s)
  if (line.kind === 'verified') return 'Verified Seller'
  if (line.kind === 'new') return 'No Sales Yet'
  return [
    line.rating ? `${line.rating.percent}% Positive` : null,
    line.rating ? `${line.rating.reviews.toLocaleString('en-US')} ${line.rating.reviews === 1 ? 'Review' : 'Reviews'}` : null,
    line.sales > 0 ? `${line.sales.toLocaleString('en-US')} Sold` : null,
    line.tierLabel,
  ]
    .filter(Boolean)
    .join(' · ')
}

export type SellerPill = { kind: 'positive' | 'reviews' | 'sold' | 'new' | 'verified' | 'since'; label: string }

/**
 * The checkout item card's seller pills (owner 2026-10-27, Eldorado-style
 * "99.6% positive · 84237 reviews · Verified since 2021"): the same rule as
 * the stat line, as chips. The tier stays on the stat line. "Member Since"
 * is the account year: we have no verification date, so an unverified
 * seller never gets a "Verified" claim.
 */
export function sellerPills(s: SellerStatInput & { memberSince?: string | null }): SellerPill[] {
  const line = sellerStatLine(s)
  const pills: SellerPill[] = []
  if (line.kind === 'new') pills.push({ kind: 'new', label: 'New Seller' })
  if (line.kind === 'stats' && line.rating) {
    const r = line.rating.reviews
    pills.push({ kind: 'positive', label: `${line.rating.percent}% Positive` })
    pills.push({ kind: 'reviews', label: `${r.toLocaleString('en-US')} ${r === 1 ? 'Review' : 'Reviews'}` })
  } else if (line.kind === 'stats' && line.sales > 0) {
    pills.push({ kind: 'sold', label: `${line.sales.toLocaleString('en-US')} Sold` })
  }
  if (s.verified !== false) {
    pills.push({ kind: 'verified', label: 'Verified Seller' })
  } else {
    const year = s.memberSince ? new Date(s.memberSince).getUTCFullYear() : NaN
    if (Number.isFinite(year)) pills.push({ kind: 'since', label: `Member Since ${year}` })
  }
  return pills
}
