import { describe, it, expect } from 'vitest'
import { sellDescription, sellFaq, sellTitle, type SellCopyInput } from './sell-copy'

const valuable = [
  { name: 'Bat Dragon', priceUsd: 290, form: 'Fly Ride' },
  { name: 'Shadow Dragon', priceUsd: 250, form: 'Fly Ride' },
  { name: 'Frost Dragon', priceUsd: 120.5, form: 'Fly Ride' },
]
const values: SellCopyInput = { gameSlug: 'adopt-me', name: 'Adopt Me', noun: 'Pets', tier: 'values', pricedCount: 781, valuable, offers: { total: 14, fromUsd: 2 } }
const listings: SellCopyInput = {
  gameSlug: 'blox-fruits', name: 'Blox Fruits', noun: 'Accounts', tier: 'listings',
  offers: { total: 40, fromUsd: 0.99 },
  categories: [{ name: 'Accounts', count: 30, fromUsd: 4 }, { name: 'Items', count: 10, fromUsd: 0.99 }, { name: 'Gems', count: 0, fromUsd: null }],
}
const categories: SellCopyInput = {
  gameSlug: 'grow-a-garden', name: 'Grow a Garden', noun: 'Items', tier: 'categories',
  categories: [{ name: 'Accounts', count: 0, fromUsd: null }, { name: 'Pets', count: 0, fromUsd: null }],
  players: { playingNow: 21605, peak7d: 44090 },
}
const bare: SellCopyInput = { gameSlug: 'x', name: 'Some Game', noun: 'Items', tier: 'categories', categories: [] }
const all = [values, listings, categories, bare]
const everyString = (i: SellCopyInput) => [sellTitle(i), sellDescription(i), ...sellFaq(i).flatMap((f) => [f.q, f.a])]

describe('sell page copy (owner, 2026-10-21: no fee upfront)', () => {
  it('never shows a fee or a percentage', () => {
    for (const input of all) for (const s of everyString(input)) expect(s, s).not.toMatch(/%|\bfee\b/i)
  })

  it('titles name the game and what is sold, for real money', () => {
    expect(sellTitle(values)).toBe('Sell Adopt Me Pets for Real Money')
    expect(sellTitle(listings)).toBe('Sell Blox Fruits Accounts for Real Money')
  })

  it('descriptions lead with the strongest real number the page has', () => {
    expect(sellDescription(values)).toBe('781 Adopt Me pets priced daily: Bat Dragon (Fly Ride) sells for $290. Sell yours for real money on DropMarket. List free and get paid when it sells.')
    expect(sellDescription(listings)).toMatch(/^40 Blox Fruits offers live on DropMarket from \$0\.99\./)
    expect(sellDescription(categories)).toMatch(/^21,605 people are playing Grow a Garden right now\./)
    expect(sellDescription(bare)).toMatch(/^Sell your Some Game items for real money on DropMarket, with SafeDrop Protection/)
    for (const input of all) expect(sellDescription(input).length, sellDescription(input)).toBeLessThanOrEqual(160)
  })

  it('values games answer from their own prices, plus the forms question', () => {
    const qs = sellFaq(values)
    expect(qs[0]).toEqual({
      q: 'What are the most valuable Adopt Me pets to sell?',
      a: 'Right now: Bat Dragon (Fly Ride) at $290, Shadow Dragon (Fly Ride) at $250 and Frost Dragon (Fly Ride) at $120.50. Prices update daily from live listings by reputable sellers.',
    })
    expect(qs[1].q).toBe('How much is a Bat Dragon worth?')
    expect(qs.map((f) => f.q)).toContain('Do Neon and Mega Neon pets sell for more?')
  })

  it('listing games list what is live; category-only games get one question per category and the player count', () => {
    expect(sellFaq(listings).find((f) => f.q === 'What Blox Fruits accounts can I sell on DropMarket?')?.a).toBe(
      'Blox Fruits buyers are shopping Accounts (30 live, from $4) and Items (10 live, from $0.99). List yours in the same section.',
    )
    const qs = sellFaq(categories).map((f) => f.q)
    expect(qs).toEqual(expect.arrayContaining(['Can I sell Grow a Garden accounts?', 'Can I sell Grow a Garden pets?', 'How many people play Grow a Garden?']))
  })

  it('every page keeps the four seller basics, with the cost question answered without a number', () => {
    for (const input of all) {
      const qs = sellFaq(input).map((f) => f.q)
      expect(qs).toEqual(expect.arrayContaining([`How do I sell ${input.name} for real money?`, 'What does it cost to sell?', 'Is it safe to sell here?', 'How do I get paid?']))
    }
    expect(sellFaq(bare).find((f) => f.q === 'What does it cost to sell?')!.a).not.toMatch(/\d/)
  })
})
