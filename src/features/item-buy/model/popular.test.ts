import { describe, expect, it } from 'vitest'
import { stockedToGridItems } from './popular'

describe('stockedToGridItems', () => {
  it('maps a stocked pet to the Items page card: rarity, offers, cheapest price, form chips', () => {
    const [card] = stockedToGridItems('adopt-me', [
      { slug: 'owl', name: 'Owl', rarity: 'legendary', imageUrl: 'https://x/owl.webp', count: 3, minPriceUsd: 64.99, href: '/adopt-me/buy-items/item/owl', variants: ['fly-ride', 'neon-fly-ride'] },
    ])
    expect(card).toMatchObject({ key: 'owl', name: 'Owl', rarityLabel: 'Legendary', offers: 3, minPrice: 64.99, href: '/adopt-me/buy-items/item/owl', forms: ['FR', 'NFR'] })
    expect(card.rarityColor).toBeTruthy()
  })

  it('games without short form labels get no chips', () => {
    const [card] = stockedToGridItems('steal-a-brainrot', [
      { slug: 'garama', name: 'Garama', rarity: 'Secret', count: 1, minPriceUsd: 9, href: '/steal-a-brainrot/buy-items/item/garama', variants: ['default'] },
    ])
    expect(card.forms).toEqual([])
    expect(card.imageUrl).toBeNull()
  })
})
