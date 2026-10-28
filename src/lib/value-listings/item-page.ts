/**
 * Pure model for the item listings page `/{game}/{category}/item/{item}[/{variant}]`.
 *
 * Rules:
 *   · unknown item, or a variant the game doesn't have → null (404, decided
 *     before any listing is rendered)
 *   · itemRows = every live listing of the item (all variants), cheapest
 *     first: the pet page's buy box, trait picker and offers list
 *   · results = itemRows of the URL's variant (all of them without one): the
 *     page's title and description
 *   · the item has no live listing at all → similar items with stock (same
 *     rarity, then closest market value); with listings → the same pick as
 *     `related`, the pet-to-pet links under the page
 *   · indexable once the item has ITEM_PAGE_MIN_LISTINGS live listing
 *     (all variants) and the page itself has results; a variant page
 *     canonicals to its item page
 */
import { itemBuyHref, type ItemStock } from './buy-state'
import { variantLabel, type CatalogItemRow, type LoadedCatalog } from './catalogs'
import { aggregateStock, pickSimilarItems } from './stock'

export interface ItemPageRow {
  id: string
  value_item_slug: string
  value_variant: string | null
  price: number | string
}

export interface ItemPageInput<T extends ItemPageRow> {
  gameSlug: string
  categorySlug: string
  catalog: LoadedCatalog
  itemSlug: string
  variant: string | null
  rows: readonly T[]
}

export interface ItemPageModel<T extends ItemPageRow> {
  item: CatalogItemRow
  variant: string | null
  variantLabel: string | null
  /** "Gold Dragon Cannelloni", "Neon Bat Dragon"; the bare name for SAB Default. */
  fullName: string
  /** Every live listing of the item, all variants, cheapest first. */
  itemRows: T[]
  /** itemRows of the URL's variant (all of them without one). */
  results: T[]
  stock: ItemStock | null
  minPriceUsd: number | null
  indexable: boolean
  canonicalPath: string
  /** Items with stock to offer instead, only when this item has none at all. */
  similar: StockedItem[]
  /** Other items with stock (same rarity first), only when this item has some: the pet-to-pet links. */
  related: StockedItem[]
}

export type StockedItem = CatalogItemRow & { count: number; minPriceUsd: number; href: string }

/**
 * Owner, 2026-10-27 (was 5 from 2026-10-10): an item page is indexable from
 * its first live listing. It is one fixed page per pet that stays up as
 * listings sell, with the trait price table, details and FAQ on it, so one
 * offer is no longer a thin page. With none it still renders (Notify Me,
 * similar items) but is noindex,follow.
 */
export const ITEM_PAGE_MIN_LISTINGS = 1

const SIMILAR_LIMIT = 4
/** Pet-to-pet links: enough for Google to walk the catalogue, few enough to keep the page light. */
const RELATED_LIMIT = 8

export function isKnownVariant(catalog: LoadedCatalog, variant: string): boolean {
  if (catalog.catalog.defaultVariant === variant) return true
  return catalog.catalog.variants.some((v) => v.key === variant)
}

export function buildItemPage<T extends ItemPageRow>(input: ItemPageInput<T>): ItemPageModel<T> | null {
  const { gameSlug, categorySlug, catalog, itemSlug, variant } = input
  const item = catalog.items.find((i) => i.slug === itemSlug)
  if (!item) return null
  if (variant && !isKnownVariant(catalog, variant)) return null

  const byPrice = (a: T, b: T) => Number(a.price) - Number(b.price)
  const label = (v: string) => variantLabel(gameSlug, v, catalog.mutations) ?? v
  const vLabel = variant ? label(variant) : null
  const fullName = vLabel && variant !== 'default' ? `${vLabel} ${item.name}` : item.name

  const stockMap = aggregateStock(
    input.rows.map((r) => ({ itemSlug: r.value_item_slug, variant: r.value_variant, unitPriceUsd: Number(r.price) })),
  )
  const stock = stockMap.get(itemSlug) ?? null
  const itemRows = input.rows.filter((r) => r.value_item_slug === itemSlug).sort(byPrice)
  const results = variant ? itemRows.filter((r) => r.value_variant === variant) : itemRows

  const inStock = itemRows.length > 0
  const others: StockedItem[] = pickSimilarItems(
    itemSlug,
    catalog.items,
    (s) => (stockMap.get(s)?.total ?? 0) > 0,
    inStock ? RELATED_LIMIT : SIMILAR_LIMIT,
  ).map((c) => {
    const s = stockMap.get(c.slug)!
    return { ...c, count: s.total, minPriceUsd: s.minPriceUsd ?? 0, href: itemBuyHref({ gameSlug, categorySlug, itemSlug: c.slug }) }
  })

  return {
    item,
    variant,
    variantLabel: vLabel,
    fullName,
    itemRows,
    results,
    stock,
    minPriceUsd: results.length ? Number(results[0].price) : null,
    indexable: results.length > 0 && itemRows.length >= ITEM_PAGE_MIN_LISTINGS,
    canonicalPath: itemBuyHref({ gameSlug, categorySlug, itemSlug, variant: null }),
    similar: inStock ? [] : others,
    related: inStock ? others : [],
  }
}
