/**
 * Items page grid model (values games): one card per catalogue item with OUR
 * stock, the Popular / Cheapest / Priciest orders, the filters and the page
 * slice. Pure, so every rule is a unit test; the server feeds it the shared
 * values feed (lib/value-listings/feed) and the client re-runs it as the
 * visitor filters. Every card links to the item's page (its offers), never to
 * the value page (values → market only).
 */
import { rarityMeta, rarityRank } from '@/lib/values/rarity'
import type { ValuesFeed } from '@/lib/value-listings/feed/types'
import type { AmLetter } from '@/features/item-buy/model/am-traits'

/** One form of an item in stock, with its own page. */
export interface GridForm {
  variant: string
  label: string
  count: number
  minPrice: number
  href: string
}

export interface GridItem {
  /** React key: the slug, or `slug:variant` for a one-trait card. */
  key: string
  slug: string
  name: string
  imageUrl: string | null
  rarityKey: string | null
  itemType: string | null
  isNew: boolean
  /** Orders out-of-stock items only; never shown. */
  rankValue: number
  /** 1 = most popular (market demand, `pnpm adoptme:popularity`); orders the Popular sort. Null when unranked. */
  popularRank: number | null
  /** Our live listings of the item. */
  offers: number
  /** Our cheapest live price, or null when we have none. */
  minPrice: number | null
  /** Short labels of the forms in stock ("FR", "NFR"). */
  forms: string[]
  /** The item page: every offer for it, best first. */
  href: string
  /** Each form in stock, cheapest first (search and the trait filter split the card by these). */
  formsInStock: GridForm[]
  /** On a one-trait card (search, trait filter): its trait, the only thing telling it from its siblings. */
  pickedForm?: string
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

const inPriceRange = (p: number, f: GridFilters) => (f.minPrice == null || p >= f.minPrice) && (f.maxPrice == null || p <= f.maxPrice)

export function toGridItems(gameSlug: string, feed: ValuesFeed, categorySlug: string | null = feed.categorySlug): GridItem[] {
  const base = `/${gameSlug}/${categorySlug ?? 'buy-items'}/item/`
  // No picture and nothing on sale: not worth a blank card (owner, 2026-11-04). Its page still exists.
  const shown = feed.items.filter((i) => i.imageUrl || (feed.stock[i.slug] ?? 0) > 0)
  return shown.map((i) => {
    return {
      key: i.slug,
      slug: i.slug,
      name: i.name,
      imageUrl: i.imageUrl,
      rarityKey: i.rarityKey,
      itemType: i.itemType,
      isNew: i.isNew,
      rankValue: i.valueUsd ?? 0,
      popularRank: i.popularRank,
      offers: feed.stock[i.slug] ?? 0,
      minPrice: feed.minPrice[i.slug] ?? null,
      forms: feed.forms[i.slug] ?? [],
      href: `${base}${i.slug}`,
      formsInStock: (feed.formStock?.[i.slug] ?? []).map((f) => ({ ...f, href: `${base}${i.slug}/${f.variant}` })),
    }
  })
}

/**
 * Search or a trait filter (owner, 2026-10-27): one card per trait in stock,
 * each with that trait's own price and offer count and a link to its trait
 * page, so "parrot" lists Parrot, FR Parrot and NFR Parrot side by side. The
 * trait filter keeps only the picked traits; the price filter reads each
 * trait's price. Items with no form in stock stay one card.
 */
export function splitByForm(items: readonly GridItem[], f: GridFilters): GridItem[] {
  if (!f.search.trim() && f.forms.length === 0) return [...items]
  return items.flatMap((i) => {
    if (i.formsInStock.length === 0) return [i]
    return i.formsInStock
      .filter((x) => (f.forms.length === 0 || f.forms.includes(x.label)) && inPriceRange(x.minPrice, f))
      .map((x) => ({ ...i, key: `${i.slug}:${x.variant}`, offers: x.count, minPrice: x.minPrice, forms: [x.label], href: x.href, formsInStock: [], pickedForm: x.label }))
  })
}

/** Out of stock: most wanted first, so Notify Me on them is easy to find; then New, then by value (the catalogue's own order breaks ties). */
function outOfStockOrder(a: GridItem, b: GridItem): number {
  const rank = (i: GridItem) => i.popularRank ?? Number.POSITIVE_INFINITY
  return rank(a) - rank(b) || Number(b.isNew) - Number(a.isNew) || b.rankValue - a.rankValue
}

export function sortGrid(items: readonly GridItem[], sort: GridSort): GridItem[] {
  const inStock = items.filter((i) => i.offers > 0)
  const out = items.filter((i) => i.offers === 0).sort(outOfStockOrder)
  const price = (i: GridItem) => i.minPrice ?? Number.POSITIVE_INFINITY
  const rank = (i: GridItem) => i.popularRank ?? Number.POSITIVE_INFINITY
  if (sort === 'cheapest') inStock.sort((a, b) => price(a) - price(b))
  else if (sort === 'priciest') inStock.sort((a, b) => price(b) - price(a))
  // Popular (owner, 2026-11-03): the pets buyers want most first, then the most offers, then cheapest.
  else inStock.sort((a, b) => rank(a) - rank(b) || b.offers - a.offers || price(a) - price(b))
  return [...inStock, ...out]
}

export function filterGrid(items: readonly GridItem[], f: GridFilters): GridItem[] {
  const q = f.search.trim().toLowerCase()
  const priced = f.minPrice != null || f.maxPrice != null
  // Split into trait cards (splitByForm): the price filter reads each trait's own price.
  const split = q !== '' || f.forms.length > 0
  return items.filter((i) => {
    if (f.rarities.length > 0 && !f.rarities.includes(i.rarityKey ?? '')) return false
    if (f.types.length > 0 && !f.types.includes(i.itemType ?? '')) return false
    if (f.forms.length > 0 && !i.forms.some((x) => f.forms.includes(x))) return false
    if (priced && split && i.formsInStock.length > 0) {
      if (!i.formsInStock.some((x) => inPriceRange(x.minPrice, f))) return false
    } else if (priced) {
      if (i.minPrice == null) return false
      if (f.minPrice != null && i.minPrice < f.minPrice) return false
      if (f.maxPrice != null && i.minPrice > f.maxPrice) return false
    }
    if (q && !i.name.toLowerCase().includes(q)) return false
    return true
  })
}

/** Matches no form: ticked letters nothing in stock has must show nothing, not everything. */
const NO_FORM = '-'

/**
 * Adopt Me's N / M / F / R ticks on the Items page: every form with ALL the
 * ticked letters, so "Neon" finds N and NFR pets and Fly + Ride finds FR, NFR
 * and MFR (browsing a whole catalogue, where an exact match would come up empty;
 * the pet page's offer filter lands on one form because it is one pet).
 */
export function formsForLetters(letters: readonly AmLetter[], available: readonly string[]): string[] {
  if (letters.length === 0) return []
  const hits = available.filter((code) => letters.every((l) => code.includes(l)))
  return hits.length > 0 ? hits : [NO_FORM]
}

/** Tick or untick one letter; Neon and Mega Neon exclude each other, as in the game. */
export function toggleGridLetter(letters: readonly AmLetter[], letter: AmLetter): AmLetter[] {
  if (letters.includes(letter)) return letters.filter((l) => l !== letter)
  const rival: AmLetter | null = letter === 'N' ? 'M' : letter === 'M' ? 'N' : null
  return [...letters.filter((l) => l !== rival), letter]
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
