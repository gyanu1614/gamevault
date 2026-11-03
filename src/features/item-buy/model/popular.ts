/**
 * The pet page's popular carousel reuses the Items page card (GridCard), so
 * a stocked item from the page model becomes the card's GridItem here: the
 * game's rarity label and colour, our offer count and cheapest price. Pure.
 */
import type { GridItem } from '@/features/items-grid/model/grid'
import type { StockedItem } from '@/lib/value-listings/item-page'
import { rarityMeta } from '@/lib/values/rarity'

export function stockedToGridItems(gameSlug: string, items: readonly StockedItem[]): GridItem[] {
  return items.map((s) => {
    const rarity = s.rarity ? rarityMeta(gameSlug, s.rarity) : null
    return {
      key: s.slug,
      slug: s.slug,
      name: s.name,
      imageUrl: s.imageUrl ?? null,
      rarityKey: rarity?.key ?? null,
      rarityLabel: rarity?.label ?? null,
      rarityColor: rarity?.color ?? null,
      itemType: null,
      isNew: false,
      rankValue: 0,
      popularRank: null,
      offers: s.count,
      minPrice: s.minPriceUsd,
      forms: [],
      href: s.href,
      formsInStock: [],
    }
  })
}
