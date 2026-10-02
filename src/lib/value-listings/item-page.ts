/**
 * Pure model for the item listings page `/{game}/{category}/item/{item}[/{variant}]`.
 *
 * Rules:
 *   · unknown item, or a variant the game doesn't have → null (404, decided
 *     before any listing is rendered)
 *   · results = the item's live listings (and variant, when given), cheapest first
 *   · nothing to show → fallback, in this order: (1) other variants of the
 *     same item, (2) similar items with stock (same rarity, then closest
 *     market value), (3) the page's actions (sell / browse)
 *   · indexable only with results; a variant page canonicals to its item page
 */
import { itemBuyHref, type ItemStock } from './buy-state'
import { variantLabel, type CatalogItemRow, type LoadedCatalog } from './catalogs'
import { aggregateStock, otherVariants, pickSimilarItems } from './stock'

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
  results: T[]
  stock: ItemStock | null
  minPriceUsd: number | null
  indexable: boolean
  canonicalPath: string
  /** Variants that have stock, for the chips row. */
  variantsInStock: Array<{ variant: string; label: string; count: number; minPriceUsd: number; href: string }>
  fallback: null | {
    otherVariants: Array<{ variant: string; label: string; count: number; minPriceUsd: number; href: string }>
    otherVariantRows: T[]
    similar: Array<CatalogItemRow & { count: number; minPriceUsd: number; href: string }>
  }
}

const SIMILAR_LIMIT = 4
const OTHER_VARIANT_ROWS = 6

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

  const ref = { gameSlug, categorySlug, itemSlug }
  const variantEntry = (v: { variant: string; count: number; minPriceUsd: number }) => ({
    ...v,
    label: label(v.variant),
    href: itemBuyHref({ ...ref, variant: v.variant }),
  })
  const variantsInStock = stock ? otherVariants(stock, null).map(variantEntry) : []

  let fallback: ItemPageModel<T>['fallback'] = null
  if (results.length === 0) {
    const others = stock ? otherVariants(stock, variant).map(variantEntry) : []
    const similar = pickSimilarItems(itemSlug, catalog.items, (s) => (stockMap.get(s)?.total ?? 0) > 0, SIMILAR_LIMIT).map((c) => {
      const s = stockMap.get(c.slug)!
      return { ...c, count: s.total, minPriceUsd: s.minPriceUsd ?? 0, href: itemBuyHref({ gameSlug, categorySlug, itemSlug: c.slug }) }
    })
    fallback = {
      otherVariants: others,
      otherVariantRows: variant ? itemRows.slice(0, OTHER_VARIANT_ROWS) : [],
      similar,
    }
  }

  return {
    item,
    variant,
    variantLabel: vLabel,
    fullName,
    results,
    stock,
    minPriceUsd: results.length ? Number(results[0].price) : null,
    indexable: results.length > 0,
    canonicalPath: itemBuyHref({ ...ref, variant: null }),
    variantsInStock,
    fallback,
  }
}
