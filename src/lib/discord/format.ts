/**
 * Discord-side presentation helpers.
 *
 * Money, income and confidence wording all come from `@/lib/sab/format` rather
 * than being re-implemented here — the bot quoting "high" while the site says
 * "Highly Accurate" for the same number is exactly the kind of drift that makes
 * people distrust both.
 */

import { formatCash, formatConfidence, formatIncome } from '@/lib/sab/format'

export { formatCash, formatConfidence, formatIncome }

/**
 * Rarity accent colours, mirroring `_ValuesDirectoryClient.tsx` so a rarity
 * reads the same colour in Discord as on the site. Discord wants an integer,
 * not a hex string.
 */
const RARITY_COLORS: Record<string, number> = {
  Secret: 0xe23b4e,
  'Brainrot God': 0xff8a3d,
  Mythic: 0xa98bff,
  Legendary: 0xf5c542,
  Epic: 0x7fe3f0,
  Rare: 0x4fb477,
  Common: 0x9ba8a0,
  OG: 0xe7c6ff,
}

/** DropMarket forest green — used when a rarity is unknown or irrelevant. */
export const BRAND_COLOR = 0x4fb477

export function rarityColor(rarity: string | null | undefined): number {
  if (!rarity) return BRAND_COLOR
  return RARITY_COLORS[rarity] ?? BRAND_COLOR
}

/**
 * Discord renders `<t:unix:R>` as a live relative timestamp ("4 hours ago")
 * in each viewer's own locale, and it keeps counting after the message is
 * posted — which a baked-in string would not.
 */
export function relativeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return `<t:${Math.floor(parsed / 1000)}:R>`
}

/** Truncate to a hard Discord limit, leaving room for the ellipsis. */
export function clamp(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1))}…`
}

/**
 * A price range, or null when we don't have both ends.
 *
 * A range that collapses to a single point is deliberately not shown: that's
 * the n=1 signature (low == high == the one listing), and printing "$9.98 –
 * $9.98" dresses a guess up as a measurement.
 */
export function formatRange(
  low: number | null,
  high: number | null,
): string | null {
  if (low == null || high == null) return null
  if (low === high) return null
  const lowText = formatCash(low)
  const highText = formatCash(high)
  if (!lowText || !highText) return null
  return `${lowText} – ${highText}`
}

/** Percentage difference between two totals, signed, one decimal. */
export function formatPercentDelta(from: number, to: number): string {
  if (from <= 0) return '—'
  const delta = ((to - from) / from) * 100
  const rounded = Math.abs(delta) < 0.05 ? 0 : delta
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}%`
}
