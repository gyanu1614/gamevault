import { describe, it, expect } from 'vitest'
import { hubThings, resolveGameSeo } from './templates'

describe('game hub description (owner-approved 2026-10-07)', () => {
  it('lists the real categories in buyer words, brand names kept', () => {
    expect(hubThings('Roblox', ['Robux', 'Items', 'Accounts'])).toBe('Robux, items and accounts')
    expect(hubThings('Adopt Me', ['Accounts', 'Items'])).toBe('accounts and items')
    expect(hubThings('Fortnite', ['Fortnite Accounts', 'V-Bucks', 'Fortnite Items', 'Boosting'])).toBe('accounts, V-Bucks and items')
    expect(hubThings('Valorant', [])).toBe('items, accounts and currency')
  })
  it('reads like the approved copy and fits in 155 characters', () => {
    const { description } = resolveGameSeo({ name: 'Roblox', categoryLabels: ['Robux', 'Items', 'Accounts'] })
    expect(description).toBe(
      'Buy Roblox Robux, items and accounts safely from verified sellers. Fast delivery, secure checkout and a full refund if it never arrives.',
    )
    const long = resolveGameSeo({ name: '99 Nights in the Forest', categoryLabels: ['Currency', 'Items', 'Accounts'] })
    expect(long.description!.length).toBeLessThanOrEqual(155)
    expect(long.description).not.toMatch(/digital goods/)
  })
})
