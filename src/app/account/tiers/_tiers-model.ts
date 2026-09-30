/**
 * Seller rank page model: pure functions over seller_tier_config rows and the
 * 90-day window facts get_seller_tier_info returns. Mirrors the SQL
 * (check_seller_tier_eligibility, upgrade_all_seller_tiers):
 *
 *   - a rank needs ALL of: counted 90-day volume (one buyer counts for at
 *     most 30%), 90-day completed orders, % positive reviews (no reviews in
 *     the window passes), completion rate (cancelled/refunded excluded);
 *   - the daily check only moves a seller UP; ranks never drop.
 *
 * The old page read the legacy min_sales / min_age_days columns (all 0 since
 * the volume ranks) and showed "0 / 0 ✓", a "you qualify for bronze" line to
 * a Gold seller, and Bronze's listing limit for an unlimited rank.
 */

export interface RankConfig {
  tier: string
  display_name: string
  description: string | null
  sort_order: number
  gmv_90d_min: number | null
  orders_90d_min: number | null
  positive_rating_min: number | null
  min_completion_rate: number | null
  /** Percentage POINTS off the category rate (fee engine), never a rate. */
  discount_pts: number | null
  listing_limit: number | null
  banner_access: boolean
  pre_moderation_listings?: number | null
  bulk_daily_cap?: number | null
}

export interface RankWindow {
  /** Counted 90-day volume (USD, single-buyer capped). */
  gmv: number
  orders: number
  /** null = no reviews in the window (passes the bar). */
  positivePct: number | null
  completionPct: number
}

export type RankStatus = 'reached' | 'current' | 'next' | 'locked'

export interface Requirement {
  key: 'volume' | 'orders' | 'positive' | 'completion'
  label: string
  value: string
  target: string
  met: boolean
  /** 0–1, for the bar. */
  progress: number
}

export interface Perk {
  key: string
  label: string
  detail: string
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`
const num = (v: number | null | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function sortLadder(configs: RankConfig[]): RankConfig[] {
  return [...configs].sort((a, b) => a.sort_order - b.sort_order)
}

function indexOf(ladder: RankConfig[], tier: string | null | undefined): number {
  const i = ladder.findIndex((t) => t.tier === tier)
  return i === -1 ? 0 : i
}

export function rankStatus(ladder: RankConfig[], tier: string, currentTier: string | null | undefined): RankStatus {
  const at = indexOf(ladder, tier)
  const cur = indexOf(ladder, currentTier)
  if (at < cur) return 'reached'
  if (at === cur) return 'current'
  return at === cur + 1 ? 'next' : 'locked'
}

export function nextRank(ladder: RankConfig[], currentTier: string | null | undefined): RankConfig | null {
  return ladder[indexOf(ladder, currentTier) + 1] ?? null
}

/** The rank the next daily check will move the seller to, or null. */
export function pendingUpgrade(
  ladder: RankConfig[],
  currentTier: string | null | undefined,
  eligibleTier: string | null | undefined,
): RankConfig | null {
  if (!eligibleTier) return null
  const e = ladder.findIndex((t) => t.tier === eligibleTier)
  return e > indexOf(ladder, currentTier) ? ladder[e] : null
}

export function requirementsFor(config: RankConfig, w: RankWindow): Requirement[] {
  const rows: Requirement[] = []
  const gmvMin = num(config.gmv_90d_min)
  if (gmvMin > 0) {
    rows.push({
      key: 'volume',
      label: '90-Day Sales Volume',
      value: usd(w.gmv),
      target: usd(gmvMin),
      met: w.gmv >= gmvMin,
      progress: Math.min(1, w.gmv / gmvMin),
    })
  }
  const ordersMin = num(config.orders_90d_min)
  if (ordersMin > 0) {
    rows.push({
      key: 'orders',
      label: '90-Day Completed Orders',
      value: w.orders.toLocaleString('en-US'),
      target: ordersMin.toLocaleString('en-US'),
      met: w.orders >= ordersMin,
      progress: Math.min(1, w.orders / ordersMin),
    })
  }
  if (config.positive_rating_min != null) {
    const min = num(config.positive_rating_min)
    const none = w.positivePct == null
    rows.push({
      key: 'positive',
      label: 'Positive Feedback',
      value: none ? 'No Reviews Yet' : pct(w.positivePct as number),
      target: pct(min),
      met: none || (w.positivePct as number) >= min,
      progress: none ? 1 : Math.min(1, (w.positivePct as number) / min),
    })
  }
  if (config.min_completion_rate != null) {
    const min = num(config.min_completion_rate)
    rows.push({
      key: 'completion',
      label: 'Completion Rate',
      value: pct(w.completionPct),
      target: pct(min),
      met: w.completionPct >= min,
      progress: min > 0 ? Math.min(1, w.completionPct / min) : 1,
    })
  }
  return rows
}

export function discountLabel(pts: number | null | undefined): string {
  const p = num(pts)
  if (p <= 0) return 'Standard Rate'
  const s = p.toFixed(2).replace(/\.?0+$/, '')
  return `−${s} ${p === 1 ? 'pt' : 'pts'}`
}

export function listingLimitLabel(limit: number | null | undefined): string {
  return limit == null ? 'Unlimited' : `Up to ${limit.toLocaleString('en-US')}`
}

export function perksFor(config: RankConfig): Perk[] {
  const perks: Perk[] = [
    {
      key: 'discount',
      label: num(config.discount_pts) > 0 ? `${discountLabel(config.discount_pts)} Off Your Rate` : 'Standard Category Rate',
      detail: 'Points off the category rate on every sale',
    },
    {
      key: 'listings',
      label: `${listingLimitLabel(config.listing_limit)} Active Offers`,
      detail: 'How many offers you can have live at once',
    },
  ]
  const reviewed = num(config.pre_moderation_listings)
  perks.push(
    reviewed > 0
      ? { key: 'review', label: `First ${reviewed} Offers Reviewed`, detail: 'Checked by our team before they go live' }
      : { key: 'review', label: 'Offers Go Live Instantly', detail: 'No manual review before publishing' },
  )
  if (num(config.bulk_daily_cap) > 0) {
    perks.push({
      key: 'bulk',
      label: `Bulk Upload ${num(config.bulk_daily_cap).toLocaleString('en-US')} a Day`,
      detail: 'Offers you can import per day',
    })
  }
  if (config.banner_access) {
    perks.push({ key: 'banner', label: 'Custom Shop Banner', detail: 'Your own artwork across the top of your shop' })
  }
  return perks
}
