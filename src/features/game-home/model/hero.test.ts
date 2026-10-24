import { describe, it, expect } from 'vitest'
import { heroFacts } from './hero'

describe('heroFacts', () => {
  it('states offers, price and delivery when all are known', () => {
    expect(heroFacts({ gameName: 'Adopt Me', offerCount: 83, lowPrice: 4.99, avgDelivery: '1 hour' })).toBe(
      '83 Adopt Me offers from $4.99, delivered in about 1 hour.',
    )
  })

  it('reads naturally for a sub-hour delivery', () => {
    expect(heroFacts({ gameName: 'Adopt Me', offerCount: 2, lowPrice: 5, avgDelivery: 'under 1 hour' })).toBe(
      '2 Adopt Me offers from $5, delivered in under 1 hour.',
    )
  })

  it('drops unknown parts instead of inventing them', () => {
    expect(heroFacts({ gameName: 'Rust', offerCount: 2, lowPrice: null, avgDelivery: null })).toBe('2 Rust offers live now.')
  })

  it('uses the singular for one offer', () => {
    expect(heroFacts({ gameName: 'Rust', offerCount: 1, lowPrice: 3, avgDelivery: null })).toBe('1 Rust offer from $3.')
  })

  it('formats large counts with separators', () => {
    expect(heroFacts({ gameName: 'Roblox', offerCount: 1200, lowPrice: null, avgDelivery: '15 minutes' })).toBe(
      '1,200 Roblox offers, delivered in about 15 minutes.',
    )
  })

  it('returns null with no offers', () => {
    expect(heroFacts({ gameName: 'Rust', offerCount: 0, lowPrice: null, avgDelivery: null })).toBeNull()
  })
})
