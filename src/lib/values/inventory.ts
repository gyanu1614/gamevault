/**
 * Inventory Worth (/[game]/inventory) — the pure maths behind the tool.
 *
 * The page ships every priced item to the browser once (a compact packed
 * catalogue); the tool keeps the player's inventory as `{ slug, qty }`
 * entries, persisted in `location.hash` (`#i=slug:qty,…`) so a link carries
 * the whole inventory and nothing ever reaches the server. Everything here is
 * plain data in, plain data out: totals in cents (no float drift), the rarity
 * breakdown, the top items, the hash codec (invalid input is dropped, never
 * thrown) and the Discord trade-ad text. Unit-tested in inventory.test.ts.
 */

/** One priced item, as the tool uses it. */
export interface InventoryItem {
  slug: string
  name: string
  rarity: string | null
  imageUrl: string | null
  /** Lowest reputable asking price (USD). */
  cheapestUsd: number
  /** Typical reputable asking price (USD); the cheapest when no market price exists. */
  marketUsd: number
}

/** One line of the player's inventory. */
export interface InventoryEntry {
  slug: string
  qty: number
}

/** Most copies of one item a line can hold. */
export const MAX_QTY = 999
/** Most distinct items one inventory can hold. */
export const MAX_ENTRIES = 200
/** Longest hash the decoder reads (200 entries × a long slug fits easily). */
const MAX_HASH_CHARS = 12_000
/** Discord's message limit. */
export const DISCORD_MAX_CHARS = 2000

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/

// ── packed catalogue (server → client payload) ───────────────────────────────

/**
 * One row: [slug, name, rarity index (-1 = none), image, cheapest cents,
 * market cents]. Image is 1 when the URL is the standard `<base><slug>.webp`,
 * 0 when the item has no art, otherwise the full URL.
 */
export type PackedRow = [string, string, number, 0 | 1 | string, number, number]

export interface PackedCatalogue {
  /** Shared prefix of the standard art URLs. */
  imageBase: string
  rarities: string[]
  rows: PackedRow[]
}

const cents = (usd: number) => Math.round(usd * 100)

/**
 * Pack priced items for the client. Unpriced items are dropped (the tool only
 * totals true prices); rows are sorted most valuable first, which is also the
 * picker's default order.
 */
export function packCatalogue(
  items: Array<{
    slug: string
    name: string
    rarity: string | null
    imageUrl: string | null
    cheapestUsd: number | null
    marketUsd: number | null
  }>,
  imageBase: string,
): PackedCatalogue {
  const rarities: string[] = []
  const rows: PackedRow[] = []
  const sorted = items
    .filter((i) => i.cheapestUsd != null && i.cheapestUsd > 0 && SLUG_RE.test(i.slug))
    .sort((a, b) => b.cheapestUsd! - a.cheapestUsd! || a.name.localeCompare(b.name))
  for (const i of sorted) {
    let r = -1
    if (i.rarity) {
      r = rarities.indexOf(i.rarity)
      if (r === -1) r = rarities.push(i.rarity) - 1
    }
    const img: PackedRow[3] = !i.imageUrl ? 0 : i.imageUrl === `${imageBase}${i.slug}.webp` ? 1 : i.imageUrl
    const c = cents(i.cheapestUsd!)
    const m = i.marketUsd != null && i.marketUsd > 0 ? cents(i.marketUsd) : c
    rows.push([i.slug, i.name, r, img, c, m])
  }
  return { imageBase, rarities, rows }
}

export function unpackCatalogue(p: PackedCatalogue): InventoryItem[] {
  return p.rows.map(([slug, name, r, img, c, m]) => ({
    slug,
    name,
    rarity: r >= 0 ? p.rarities[r] ?? null : null,
    imageUrl: img === 0 ? null : img === 1 ? `${p.imageBase}${slug}.webp` : img,
    cheapestUsd: c / 100,
    marketUsd: m / 100,
  }))
}

// ── entries (add / set / remove, all capped) ─────────────────────────────────

const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)))

/** Add `by` copies; a new item goes to the top of the list. */
export function addItem(entries: InventoryEntry[], slug: string, by = 1): InventoryEntry[] {
  const i = entries.findIndex((e) => e.slug === slug)
  if (i !== -1) return setQty(entries, slug, entries[i]!.qty + by)
  const qty = clampQty(by)
  if (qty === 0 || entries.length >= MAX_ENTRIES || !SLUG_RE.test(slug)) return entries
  return [{ slug, qty }, ...entries]
}

/** Set a line's quantity; 0 (or less) removes it. */
export function setQty(entries: InventoryEntry[], slug: string, qty: number): InventoryEntry[] {
  const q = clampQty(qty)
  if (q === 0) return removeItem(entries, slug)
  return entries.map((e) => (e.slug === slug ? { slug, qty: q } : e))
}

export function removeItem(entries: InventoryEntry[], slug: string): InventoryEntry[] {
  return entries.filter((e) => e.slug !== slug)
}

// ── hash codec ───────────────────────────────────────────────────────────────

/** `i=slug:qty,slug:qty` (empty string for an empty inventory). */
export function encodeInventory(entries: InventoryEntry[]): string {
  const parts = entries
    .filter((e) => SLUG_RE.test(e.slug) && clampQty(e.qty) > 0)
    .slice(0, MAX_ENTRIES)
    .map((e) => `${e.slug}:${clampQty(e.qty)}`)
  return parts.length ? `i=${parts.join(',')}` : ''
}

/**
 * Read `#i=slug:qty,…` (leading `#` optional; a bare `slug` means 1).
 * Anything malformed is skipped: bad slugs, zero / non-numeric quantities,
 * slugs `isKnown` rejects. Repeats merge; quantities and the item count are
 * capped. Never throws.
 */
export function decodeInventory(hash: string | null | undefined, isKnown?: (slug: string) => boolean): InventoryEntry[] {
  if (typeof hash !== 'string' || !hash) return []
  const raw = hash.replace(/^#/, '').slice(0, MAX_HASH_CHARS)
  const param = raw.split('&').find((p) => p.startsWith('i='))
  if (!param) return []
  let body = param.slice(2)
  try {
    body = decodeURIComponent(body)
  } catch {
    // Malformed escapes: read the raw text.
  }
  let out: InventoryEntry[] = []
  for (const part of body.split(',')) {
    const m = /^([a-z0-9][a-z0-9-]{0,79})(?::(\d{1,6}))?$/.exec(part.trim().toLowerCase())
    if (!m) continue
    const slug = m[1]!
    const qty = m[2] == null ? 1 : clampQty(Number(m[2]))
    if (qty === 0 || (isKnown && !isKnown(slug))) continue
    const existing = out.find((e) => e.slug === slug)
    if (existing) {
      out = setQty(out, slug, existing.qty + qty)
    } else if (out.length < MAX_ENTRIES) {
      out.push({ slug, qty })
    }
  }
  return out
}

// ── maths ────────────────────────────────────────────────────────────────────

export interface InventoryLine {
  item: InventoryItem
  qty: number
  /** cheapest × qty */
  lineUsd: number
  /** market × qty */
  lineMarketUsd: number
}

/** The entries joined to the catalogue, in list order; unknown slugs are skipped. */
export function inventoryLines(entries: InventoryEntry[], bySlug: ReadonlyMap<string, InventoryItem>): InventoryLine[] {
  const out: InventoryLine[] = []
  for (const e of entries) {
    const item = bySlug.get(e.slug)
    const qty = clampQty(e.qty)
    if (!item || qty === 0) continue
    out.push({
      item,
      qty,
      lineUsd: (cents(item.cheapestUsd) * qty) / 100,
      lineMarketUsd: (cents(item.marketUsd) * qty) / 100,
    })
  }
  return out
}

export interface InventoryTotals {
  /** Sum of cheapest prices: what the same items cost to buy today. */
  cheapestUsd: number
  /** Sum of market prices: the typical asking price. */
  marketUsd: number
  /** Copies, all lines. */
  count: number
  /** Distinct items. */
  unique: number
}

export function inventoryTotals(lines: InventoryLine[]): InventoryTotals {
  let c = 0
  let m = 0
  let count = 0
  for (const l of lines) {
    c += cents(l.item.cheapestUsd) * l.qty
    m += cents(l.item.marketUsd) * l.qty
    count += l.qty
  }
  return { cheapestUsd: c / 100, marketUsd: m / 100, count, unique: lines.length }
}

export interface RarityShare {
  rarity: string
  count: number
  cheapestUsd: number
  /** Share of the cheapest total, 0–1. */
  share: number
}

/**
 * The cheapest total split by rarity, in `order` (rarest first); rarities not
 * in `order` follow, then unrated items as "Other".
 */
export function rarityBreakdown(lines: InventoryLine[], order: readonly string[]): RarityShare[] {
  const acc = new Map<string, { count: number; cents: number }>()
  let total = 0
  for (const l of lines) {
    const k = l.item.rarity ?? 'Other'
    const a = acc.get(k) ?? { count: 0, cents: 0 }
    const v = cents(l.item.cheapestUsd) * l.qty
    a.count += l.qty
    a.cents += v
    total += v
    acc.set(k, a)
  }
  const rank = (k: string) => {
    const i = order.indexOf(k)
    return i === -1 ? (k === 'Other' ? order.length + 1 : order.length) : i
  }
  return [...acc.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].cents - a[1].cents)
    .map(([rarity, a]) => ({ rarity, count: a.count, cheapestUsd: a.cents / 100, share: total > 0 ? a.cents / total : 0 }))
}

/** The n most valuable items (by one copy's cheapest price; ties by line total). */
export function topItems(lines: InventoryLine[], n = 3): InventoryLine[] {
  return [...lines]
    .sort((a, b) => b.item.cheapestUsd - a.item.cheapestUsd || b.lineUsd - a.lineUsd || a.item.name.localeCompare(b.item.name))
    .slice(0, n)
}

// ── formatting + trade ad ────────────────────────────────────────────────────

/** $1,234.56 */
export function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Escape Discord markdown in an item name. */
const escapeMd = (s: string) => s.replace(/([\\*_~`|>])/g, '\\$1')

/** Lines shown in the trade ad before "+ N more". */
export const TRADE_AD_LINES = 10

/**
 * Discord-ready trade ad: a bold header with the total, the most valuable
 * lines with their values, the total and the link. Kept under Discord's
 * 2,000 characters: when the shareable link would push it over, the ad links
 * the bare tool page instead.
 */
export function tradeAdText({
  lines,
  totals,
  shortName,
  pageUrl,
  hash,
}: {
  lines: InventoryLine[]
  totals: InventoryTotals
  shortName: string
  /** Absolute tool URL, no hash. */
  pageUrl: string
  /** `encodeInventory(...)` output. */
  hash: string
}): string {
  if (lines.length === 0) return ''
  const shown = [...lines].sort((a, b) => b.lineUsd - a.lineUsd || a.item.name.localeCompare(b.item.name)).slice(0, TRADE_AD_LINES)
  const rest = lines.length - shown.length
  const body = [
    `**${shortName} Inventory Worth ${fmtUsd(totals.cheapestUsd)}**`,
    ...shown.map((l) => `- ${escapeMd(l.item.name)}${l.qty > 1 ? ` x${l.qty}` : ''}: ${fmtUsd(l.lineUsd)}`),
    ...(rest > 0 ? [`- + ${rest} more ${rest === 1 ? 'item' : 'items'}`] : []),
    `**Total: ${fmtUsd(totals.cheapestUsd)}** (${totals.count} ${totals.count === 1 ? 'item' : 'items'}, live USD prices)`,
  ].join('\n')
  const full = `${body}\nSee it: ${pageUrl}${hash ? `#${hash}` : ''}`
  return full.length <= DISCORD_MAX_CHARS ? full : `${body}\nSee it: ${pageUrl}`
}
