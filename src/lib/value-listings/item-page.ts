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
 *     rarity, then closest market value); with listings → `related`, the
 *     most popular other items in stock (owner, 2026-11-02: a carousel of
 *     what buyers actually want, not "more of the same rarity")
 *   · indexable once the item has ITEM_PAGE_MIN_LISTINGS live listing
 *     (all variants) and the page itself has results; a variant page
 *     canonicals to its item page
 */
import { itemBuyHref, type ItemStock } from './buy-state'
import { variantLabel, type CatalogItemRow, type LoadedCatalog } from './catalogs'
import { aggregateStock, pickPopularItems, pickSimilarItems } from './stock'

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
  /** The most popular other items in stock, only when this item has some: the carousel under the page. */
  related: StockedItem[]
  /** Murder Mystery 2: this item and its Chroma version, when both exist. Empty otherwise. */
  forms: ItemForm[]
}

/** One version of an item with its own page and offers. */
export interface ItemForm {
  slug: string
  label: 'Common' | 'Chroma'
  href: string
  count: number
  minPriceUsd: number | null
}

const CHROMA_PREFIX = 'chroma-'

/**
 * In Murder Mystery 2 a Chroma item is its own catalogue row and page ("Chroma
 * Sunrise" beside "Sunrise"), so choosing Chroma on an item page opens that page
 * and its offers (owner, 2026-11-06). 52 items have both.
 */
function itemForms(
  gameSlug: string,
  categorySlug: string,
  catalog: LoadedCatalog,
  itemSlug: string,
  stockOf: (slug: string) => ItemStock | undefined,
): ItemForm[] {
  if (gameSlug !== 'murder-mystery-2') return []
  const plain = itemSlug.startsWith(CHROMA_PREFIX) ? itemSlug.slice(CHROMA_PREFIX.length) : itemSlug
  const chroma = `${CHROMA_PREFIX}${plain}`
  if (!catalog.items.some((i) => i.slug === plain) || !catalog.items.some((i) => i.slug === chroma)) return []
  const form = (slug: string, label: ItemForm['label']): ItemForm => ({
    slug,
    label,
    href: itemBuyHref({ gameSlug, categorySlug, itemSlug: slug }),
    count: stockOf(slug)?.total ?? 0,
    minPriceUsd: stockOf(slug)?.minPriceUsd ?? null,
  })
  return [form(plain, 'Common'), form(chroma, 'Chroma')]
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
/** The popular carousel: a few swipes' worth, few enough to keep the page light. */
const RELATED_LIMIT = 12

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
  const stocked = (c: CatalogItemRow): StockedItem => {
    const s = stockMap.get(c.slug)!
    return { ...c, count: s.total, minPriceUsd: s.minPriceUsd ?? 0, href: itemBuyHref({ gameSlug, categorySlug, itemSlug: c.slug }) }
  }
  const stockCount = (slug: string) => stockMap.get(slug)?.total ?? 0
  // The row under the page is the game's main items, whatever the page sells (its heading says so).
  const mainItems = catalog.items.filter((c) => !c.kind)
  const sameKind = item.kind ? catalog.items.filter((c) => c.kind === item.kind) : []
  const others: StockedItem[] = (
    inStock
      ? pickPopularItems(itemSlug, mainItems, stockCount, RELATED_LIMIT)
      : item.kind
        ? [...pickPopularItems(itemSlug, sameKind, stockCount, SIMILAR_LIMIT), ...pickPopularItems(itemSlug, mainItems, stockCount, SIMILAR_LIMIT)].slice(0, SIMILAR_LIMIT)
        : pickSimilarItems(itemSlug, mainItems, (s) => stockCount(s) > 0, SIMILAR_LIMIT)
  ).map(stocked)

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
    forms: itemForms(gameSlug, categorySlug, catalog, itemSlug, (slug) => stockMap.get(slug)),
  }
}
