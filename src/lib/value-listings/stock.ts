/**
 * Pure stock maths over DropMarket's live listings (already matched to value
 * items). The server read lives in `stock-server.ts`.
 */
import type { ItemStock, VariantStock } from './buy-state'

export interface MatchedListingRow {
  itemSlug: string
  variant: string | null
  unitPriceUsd: number
}

export function aggregateStock(rows: readonly MatchedListingRow[]): Map<string, ItemStock> {
  const map = new Map<string, ItemStock>()
  for (const row of rows) {
    const price = row.unitPriceUsd
    if (!Number.isFinite(price) || price <= 0) continue
    let item = map.get(row.itemSlug)
    if (!item) {
      item = { total: 0, minPriceUsd: null, byVariant: {} }
      map.set(row.itemSlug, item)
    }
    item.total += 1
    item.minPriceUsd = item.minPriceUsd == null ? price : Math.min(item.minPriceUsd, price)
    if (row.variant) {
      const v: VariantStock = item.byVariant[row.variant] ?? { count: 0, minPriceUsd: price }
      v.count += 1
      v.minPriceUsd = Math.min(v.minPriceUsd, price)
      item.byVariant[row.variant] = v
    }
  }
  return map
}

export function otherVariants(
  stock: ItemStock,
  chosen: string | null,
): Array<{ variant: string } & VariantStock> {
  return Object.entries(stock.byVariant)
    .filter(([variant, v]) => variant !== chosen && v.count > 0)
    .map(([variant, v]) => ({ variant, ...v }))
    .sort((a, b) => a.minPriceUsd - b.minPriceUsd)
}

export interface SimilarCandidate {
  slug: string
  name: string
  rarity?: string | null
  valueUsd?: number | null
}

/**
 * Up to `limit` items with stock, same rarity first, then closest market
 * value (by ratio, so $10 vs $12 is closer than $500 vs $600).
 */
export function pickSimilarItems<T extends SimilarCandidate>(
  targetSlug: string,
  catalog: readonly T[],
  hasStock: (slug: string) => boolean,
  limit: number,
): T[] {
  const target = catalog.find((c) => c.slug === targetSlug)
  const distance = (c: T) => {
    const a = target?.valueUsd
    const b = c.valueUsd
    if (!a || !b || a <= 0 || b <= 0) return Number.POSITIVE_INFINITY
    return Math.abs(Math.log(b / a))
  }
  return catalog
    .filter((c) => c.slug !== targetSlug && hasStock(c.slug))
    .map((c) => ({ c, same: !!target?.rarity && c.rarity === target.rarity, d: distance(c) }))
    .sort((x, y) => Number(y.same) - Number(x.same) || x.d - y.d || x.c.name.localeCompare(y.c.name))
    .slice(0, limit)
    .map((x) => x.c)
}
