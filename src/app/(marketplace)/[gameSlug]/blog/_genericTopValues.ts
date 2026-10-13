import type { ValueItem } from '@/lib/values/data'
import type { HubTeaserItem } from './_hubData'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * The blog's Live Values strip for any game on the shared values_* pipeline
 * (MM2, Steal an Egg, every future value game): the dearest priced items, at
 * their cheapest live listing. Pure, so the hub data loader and tests share it.
 */
export function topValuesFromItems(items: readonly ValueItem[], limit: number): HubTeaserItem[] {
  return items
    .filter((i) => i.price?.cheapestUsd != null && Number.isFinite(i.price.cheapestUsd))
    .sort((a, b) => (b.price!.cheapestUsd as number) - (a.price!.cheapestUsd as number))
    .slice(0, limit)
    .map((i) => {
      const n = i.price!.sampleSize
      return {
        name: i.name,
        slug: i.slug,
        imageUrl: i.imageUrl,
        priceLabel: USD.format(i.price!.cheapestUsd as number),
        qualifier: `${n} live ${n === 1 ? 'listing' : 'listings'}`,
        changePct: null,
      }
    })
}
