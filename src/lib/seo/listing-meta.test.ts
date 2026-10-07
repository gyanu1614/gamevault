import { describe, expect, it } from 'vitest'
import { cleanSellerText, listingMeta } from './listing-meta'

const base = { price: 4.5, gameName: 'Blox Fruits', categoryName: 'Items' }

describe('cleanSellerText', () => {
  it('drops emoji and trims decoration', () => {
    expect(cleanSellerText('💎Kitsune Fruit💎')).toBe('Kitsune Fruit')
    expect(cleanSellerText('🔥 OG STW + 150+ SKINS 🔥')).toBe('OG STW + 150+ SKINS')
    expect(cleanSellerText(null)).toBe('')
  })
})

describe('listingMeta', () => {
  it('adds the game to a short title so same-named items in two games differ', () => {
    const a = listingMeta({ ...base, title: '💎Kitsune Fruit💎', description: null })
    const b = listingMeta({ ...base, gameName: 'Grow a Garden', title: '💎Kitsune Fruit💎', description: null })
    expect(a.title).toBe('Kitsune Fruit – Blox Fruits')
    expect(b.title).toBe('Kitsune Fruit – Grow a Garden')
  })

  it('keeps titles within 47 characters', () => {
    const { title } = listingMeta({ ...base, title: 'The Reaper 100+ Skins Guaranteed Fortnite Account Full Access All Platforms', description: null })
    expect(title.length).toBeLessThanOrEqual(47)
    expect(title.endsWith('…')).toBe(true)
  })

  it('replaces a throwaway seller description with a full sentence', () => {
    const { description } = listingMeta({ ...base, title: 'Sheeeeep FR', gameName: 'Adopt Me', description: 'Check out my other offers :)' })
    expect(description).toBe('Buy Sheeeeep FR for Adopt Me for $4.50. Items from an ID-verified seller. Covered by SafeDrop Protection.')
  })

  it("keeps the seller's own words when they say something, within 155 characters", () => {
    const own = 'Full access account with the original email, 150 skins including Renegade Raider and Black Knight, Save the World unlocked, all platforms.'
    const { description } = listingMeta({ ...base, title: 'OG Account', gameName: 'Fortnite', price: 120, description: own })
    expect(description.startsWith('Buy OG Account for Fortnite for $120. Full access account')).toBe(true)
    expect(description.length).toBeLessThanOrEqual(155)
  })
})
