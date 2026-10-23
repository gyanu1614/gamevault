/**
 * The /[game]/sell page's item rows (values platform Step E, owner 2026-10-21):
 * "Bat Dragon · Sells For $X" with the item's picture, never the fee. Pure:
 * takes the rows the values list already loads (same cached reads) plus our
 * own stock, and applies the one price rule — our live listing when we have
 * one, else the market price.
 */
import type { BrainrotDirectoryItem } from '@/app/(marketplace)/[gameSlug]/values/_sabListModel'
import type { AdoptMePetItem } from '@/app/(marketplace)/[gameSlug]/values/_adoptMeListModel'
import type { ValueListRow } from '@/app/(marketplace)/[gameSlug]/values/_generic/valueListModel'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import type { ValueItem } from '@/lib/values/data'
import { isNewItem } from '@/lib/values/new-item'

export interface SellItem {
  slug: string
  name: string
  imageUrl: string | null
  /** Our live listing's price, else the market price; null when neither exists. */
  priceUsd: number | null
  /** Adopt Me: the form the price is for ("Fly Ride"); null elsewhere. */
  form: string | null
  /** Demand order, lower = more in demand (popularity / demand rank, else listings tracked). */
  demand: number | null
  isNew: boolean
  href: string
}

/** Our stock by item slug (value-listings/stock-server getValueStock().byItem). */
export type StockBySlug = Record<string, Pick<ItemStock, 'total' | 'minPriceUsd' | 'byVariant'>>

/** The Adopt Me form a sell row quotes: Fly Ride (the trading benchmark), else Normal. */
const AM_FORMS = [
  { code: 'FR', label: 'Fly Ride' },
  { code: 'N', label: 'Normal' },
] as const

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The one price rule: our cheapest live listing, else the market price. */
function headline(ours: { total: number; minPriceUsd: number | null } | null | undefined, marketUsd: number | null): number | null {
  if (ours && ours.total > 0 && ours.minPriceUsd != null) return ours.minPriceUsd
  return marketUsd
}

export function sellItemsFromSab(rows: readonly BrainrotDirectoryItem[], stock: StockBySlug): SellItem[] {
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    imageUrl: r.image_url,
    priceUsd: headline(stock[r.slug], num(r.average_usd) ?? num(r.display_price_usd) ?? num(r.cheapest_usd)),
    form: null,
    demand: r.popularity_rank ?? null,
    isNew: r.isNew === true,
    href: `/steal-a-brainrot/values/${r.slug}`,
  }))
}

/**
 * One row per pet at its benchmark form. Our stock counts only when it is the
 * SAME form (a Normal listing must not stand in for a Fly Ride price).
 */
export function sellItemsFromAdoptMe(rows: readonly AdoptMePetItem[], stock: StockBySlug, variantKey: (code: string) => string | null): SellItem[] {
  return rows.map((p) => {
    const form = AM_FORMS.find((f) => p.values[f.code]) ?? AM_FORMS[0]
    const v = p.values[form.code]
    const key = variantKey(form.code)
    const ours = key ? stock[p.slug]?.byVariant[key] : undefined
    return {
      slug: p.slug,
      name: p.name,
      imageUrl: p.imageUrl,
      priceUsd: headline(ours ? { total: ours.count, minPriceUsd: ours.minPriceUsd } : null, num(v?.cashUsd) ?? num(v?.cheapestUsd)),
      form: form.label,
      demand: p.demandRank,
      isNew: p.isNew === true,
      href: `/adopt-me/values/${p.slug}`,
    }
  })
}

/** values_items games (MM2, Steal an Egg): demand = rank by reputable listings tracked. */
export function sellItemsFromValueRows(gameSlug: string, rows: readonly ValueListRow[], stock: StockBySlug): SellItem[] {
  const byListed = [...rows].filter((r) => r.listedNow > 0).sort((a, b) => b.listedNow - a.listedNow)
  const rank = new Map(byListed.map((r, i) => [r.id, i + 1]))
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    imageUrl: r.imageUrl,
    priceUsd: headline(stock[r.slug], num(r.marketUsd) ?? num(r.cheapestUsd)),
    form: null,
    demand: rank.get(r.id) ?? null,
    isNew: r.isNew === true,
    href: r.href ?? `/${gameSlug}/values/${r.slug}`,
  }))
}

/** values_items games without a value list (Steal an Egg's hub reads ValueItems). */
export function sellItemsFromValueItems(gameSlug: string, items: readonly ValueItem[], stock: StockBySlug, now: number = Date.now()): SellItem[] {
  return sellItemsFromValueRows(
    gameSlug,
    items.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      rarity: i.rarity,
      itemType: i.itemType,
      imageUrl: i.imageUrl,
      href: `/${gameSlug}/values/${i.slug}`,
      cheapestUsd: i.price?.cheapestUsd ?? null,
      marketUsd: i.price?.averageUsd ?? null,
      listedNow: i.price?.sampleSize ?? 0,
      trendPct: null,
      baseItemId: i.baseItemId,
      isNew: isNewItem({ addedAt: i.addedAt, releaseYear: i.releaseYear }, now),
    })),
    stock,
  )
}

const byPriceDesc = (a: SellItem, b: SellItem) => (b.priceUsd ?? -1) - (a.priceUsd ?? -1) || a.name.localeCompare(b.name)

/** "Top To Sell Now": priced items, most in demand first (unranked after), then by price. */
export function topToSell(items: readonly SellItem[], limit = 12): SellItem[] {
  return items
    .filter((i) => i.priceUsd != null)
    .sort((a, b) => (a.demand ?? Infinity) - (b.demand ?? Infinity) || byPriceDesc(a, b))
    .slice(0, limit)
}

/** "Just Added": new items (isNewItem, 14 days), priced first. */
export function justAdded(items: readonly SellItem[], limit = 8): SellItem[] {
  return items.filter((i) => i.isNew).sort(byPriceDesc).slice(0, limit)
}

/** The FAQ's "most valuable": highest prices first. */
export function mostValuable(items: readonly SellItem[], limit = 5): SellItem[] {
  return items.filter((i) => i.priceUsd != null).sort(byPriceDesc).slice(0, limit)
}
