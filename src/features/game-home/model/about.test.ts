import { describe, it, expect } from 'vitest'
import { aboutRows, type AboutFacts } from './about'

const facts = (over: Partial<AboutFacts> = {}): AboutFacts => ({
  gameSlug: 'adopt-me',
  gameName: 'Adopt Me',
  itemNoun: 'Pets',
  itemNounSingular: 'Pet',
  categoryNames: ['Pets', 'Accounts'],
  offerCount: 83,
  lowPrice: 4.99,
  hasValues: true,
  currencyName: null,
  ...over,
})

const text = (rows: ReturnType<typeof aboutRows>) => rows.flatMap((r) => [r.heading, ...r.paragraphs]).join(' ')

describe('aboutRows', () => {
  it('gives three rows in the left / right / centre order', () => {
    const rows = aboutRows(facts())
    expect(rows.map((r) => [r.id, r.layout])).toEqual([
      ['buy', 'text-left'],
      ['what', 'text-right'],
      ['why', 'centre'],
    ])
    expect(rows.map((r) => r.heading)).toEqual([
      'Buy Adopt Me Pets From Verified Sellers',
      'What You Can Buy in Adopt Me',
      'Why Buy Adopt Me Pets on DropMarket?',
    ])
  })

  it('states the live offer count and price only when known', () => {
    expect(text(aboutRows(facts()))).toContain('83 live offers from $4.99')
    const none = text(aboutRows(facts({ offerCount: 0, lowPrice: null })))
    expect(none).not.toMatch(/live offers? from/)
    expect(text(aboutRows(facts({ offerCount: 1, lowPrice: 12 })))).toContain('1 live offer from $12')
  })

  it('lists the real categories and the value list only for a values game', () => {
    expect(text(aboutRows(facts()))).toContain('pets and accounts')
    expect(aboutRows(facts()).find((r) => r.id === 'what')?.link).toEqual({ href: '/adopt-me/values', label: 'Open the Adopt Me Value List' })
    const noValues = aboutRows(facts({ hasValues: false, categoryNames: ['Items', 'Accounts', 'Boosting'] }))
    expect(text(noValues)).not.toContain('value list')
    expect(text(noValues)).toContain('items, accounts and boosting')
  })

  it('names the currency when the game sells one', () => {
    expect(text(aboutRows(facts({ currencyName: 'Robux', categoryNames: ['Robux', 'Items'] })))).toContain('Robux')
  })

  it('never ships a placeholder or an em dash', () => {
    for (const f of [facts(), facts({ offerCount: 0, lowPrice: null, hasValues: false, categoryNames: [] })]) {
      const t = text(aboutRows(f))
      expect(t).not.toMatch(/[[\]—–]/)
    }
  })
})
