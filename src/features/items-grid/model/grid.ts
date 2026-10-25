/**
 * Items page grid model (values games): one card per catalogue item with OUR
 * stock, the Recommended / Cheapest / Priciest orders, the filters and the page
 * slice. Pure, so every rule is a unit test; the server feeds it the shared
 * values feed (lib/value-listings/feed) and the client re-runs it as the
 * visitor filters. Every card links to the item's page (its offers), never to
 * the value page (values → market only).
 */
import { rarityMeta, rarityRank } from '@/lib/values/rarity'
import type { ValuesFeed } from '@/lib/value-listings/feed/types'

export interface GridItem {
  slug: string
  name: string
  imageUrl: string | null
  rarityKey: string | null
  rarityLabel: string | null
  rarityColor: string | null
  itemType: string | null
  isNew: boolean
  /** Orders out-of-stock items only; never shown. */
  rankValue: number
  /** Our live listings of the item. */
  offers: number
  /** Our cheapest live price, or null when we have none. */
  minPrice: number | null
  /** Short labels of the forms in stock ("FR", "NFR"). */
  forms: string[]
  /** The item page: every offer for it, best first. */
  href: string
}

export type GridSort = 'recommended' | 'cheapest' | 'priciest'

export interface GridFilters {
  rarities: string[]
  types: string[]
  forms: string[]
  minPrice: number | null
  maxPrice: number | null
  search: string
}

export const EMPTY_FILTERS: GridFilters = { rarities: [], types: [], forms: [], minPrice: null, maxPrice: null, search: '' }

export function toGridItems(gameSlug: string, feed: ValuesFeed, categorySlug: string | null = feed.categorySlug): GridItem[] {
  const base = `/${gameSlug}/${categorySlug ?? 'buy-items'}/item/`
  return feed.items.map((i) => {
    const r = i.rarityKey ? rarityMeta(gameSlug, i.rarityKey) : null
    return {
      slug: i.slug,
      name: i.name,
      imageUrl: i.imageUrl,
      rarityKey: i.rarityKey,
      rarityLabel: r?.label || null,
      rarityColor: r?.color ?? null,
      itemType: i.itemType,
      isNew: i.isNew,
      rankValue: i.valueUsd ?? 0,
      offers: feed.stock[i.slug] ?? 0,
      minPrice: feed.minPrice[i.slug] ?? null,
      forms: feed.forms[i.slug] ?? [],
      href: `${base}${i.slug}`,
    }
  })
}

/** Out of stock: New first, then by value (the catalogue's own order breaks ties). */
function outOfStockOrder(a: GridItem, b: GridItem): number {
  return Number(b.isNew) - Number(a.isNew) || b.rankValue - a.rankValue
}

export function sortGrid(items: readonly GridItem[], sort: GridSort): GridItem[] {
  const inStock = items.filter((i) => i.offers > 0)
  const out = items.filter((i) => i.offers === 0).sort(outOfStockOrder)
  const price = (i: GridItem) => i.minPrice ?? Number.POSITIVE_INFINITY
  if (sort === 'cheapest') inStock.sort((a, b) => price(a) - price(b))
  else if (sort === 'priciest') inStock.sort((a, b) => price(b) - price(a))
  else inStock.sort((a, b) => b.offers - a.offers || price(a) - price(b))
  return [...inStock, ...out]
}

export function filterGrid(items: readonly GridItem[], f: GridFilters): GridItem[] {
  const q = f.search.trim().toLowerCase()
  const priced = f.minPrice != null || f.maxPrice != null
  return items.filter((i) => {
    if (f.rarities.length > 0 && !f.rarities.includes(i.rarityKey ?? '')) return false
    if (f.types.length > 0 && !f.types.includes(i.itemType ?? '')) return false
    if (f.forms.length > 0 && !i.forms.some((x) => f.forms.includes(x))) return false
    if (priced) {
      if (i.minPrice == null) return false
      if (f.minPrice != null && i.minPrice < f.minPrice) return false
      if (f.maxPrice != null && i.minPrice > f.maxPrice) return false
    }
    if (q && !i.name.toLowerCase().includes(q)) return false
    return true
  })
}

/** Adopt Me forms in the order players read them; other games sort A–Z. */
const AM_FORM_ORDER = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR']

export interface FilterOption {
  value: string
  label: string
}

const titleCase = (s: string) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Only the options that exist in this game's items, rarest rarity first. */
export function filterOptions(gameSlug: string, items: readonly GridItem[]): { rarities: FilterOption[]; types: FilterOption[]; forms: FilterOption[] } {
  const rarities = [...new Set(items.map((i) => i.rarityKey).filter((k): k is string => !!k))]
    .sort((a, b) => rarityRank(gameSlug, a) - rarityRank(gameSlug, b))
    .map((k) => ({ value: k, label: rarityMeta(gameSlug, k).label || k }))
  const types = [...new Set(items.map((i) => i.itemType).filter((t): t is string => !!t))].sort().map((t) => ({ value: t, label: titleCase(t) }))
  const formSet = [...new Set(items.flatMap((i) => i.forms))]
  const forms = (gameSlug === 'adopt-me'
    ? formSet.sort((a, b) => AM_FORM_ORDER.indexOf(a) - AM_FORM_ORDER.indexOf(b))
    : formSet.sort()
  ).map((f) => ({ value: f, label: f }))
  return { rarities, types, forms }
}
