import { describe, expect, it } from 'vitest'
import { stockedToGridItems } from './popular'

describe('stockedToGridItems', () => {
  it('maps a stocked pet to the Items page card: offers, cheapest price', () => {
    const [card] = stockedToGridItems('adopt-me', [
      { slug: 'owl', name: 'Owl', rarity: 'legendary', imageUrl: 'https://x/owl.webp', count: 3, minPriceUsd: 64.99, href: '/adopt-me/buy-items/item/owl' },
    ])
    expect(card).toMatchObject({ key: 'owl', name: 'Owl', rarityKey: 'legendary', offers: 3, minPrice: 64.99, href: '/adopt-me/buy-items/item/owl' })
  })

  it('a pet with no picture stays a card', () => {
    const [card] = stockedToGridItems('steal-a-brainrot', [
      { slug: 'garama', name: 'Garama', rarity: 'Secret', count: 1, minPriceUsd: 9, href: '/steal-a-brainrot/buy-items/item/garama' },
    ])
    expect(card.imageUrl).toBeNull()
  })
})
