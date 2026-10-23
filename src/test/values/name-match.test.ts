import { describe, it, expect } from 'vitest'
import { matchKey, nameSimilarity, closeMatch, pairUnmatched } from '../../../scripts/lib/name-match.mjs'

describe('matchKey: the spelling-insensitive form two names are compared in', () => {
  it('drops case, accents, punctuation, "the" and plain plurals', () => {
    expect(matchKey('The Ñandú Bros.')).toBe('nandu bro')
    expect(matchKey("Rock & Roll's")).toBe('rock and roll')
    expect(matchKey('  Frost   Dragon ')).toBe('frost dragon')
    expect(matchKey('Glass')).toBe('glass') // "ss" is not a plural
  })
})

describe('nameSimilarity', () => {
  it('scores a one-letter typo on a long name high, and word order the same', () => {
    expect(nameSimilarity('Wooly Rhino', 'Woolly Rhino')).toBeGreaterThan(0.9)
    expect(nameSimilarity('Dragon Frost', 'Frost Dragon')).toBe(1)
  })
  it('never treats different numbers or years as close', () => {
    expect(nameSimilarity('Ice Cube (2018)', 'Ice Cube (2019)')).toBe(0)
    expect(nameSimilarity('Bats', 'Bats 2018')).toBe(0)
  })
})

describe('closeMatch: one confident answer, or suggestions', () => {
  const pets = [
    { slug: 'woolly-rhino', names: ['Woolly Rhino'] },
    { slug: 'rhino', names: ['Rhino'] },
    { slug: 'frog', names: ['Frog'] },
    { slug: 'frost-dragon', names: ['Frost Dragon'] },
    { slug: 'frost-fury', names: ['Frost Fury'] },
  ]

  it('accepts a near-identical long name with a clear lead', () => {
    expect(closeMatch('Wooly Rhino', pets)).toMatchObject({ slug: 'woolly-rhino' })
  })

  it('refuses short names (one letter changes a 4-letter word into another item)', () => {
    const r = closeMatch('Frag', pets)
    expect(r.slug).toBeNull()
    expect(r.suggestions[0]).toMatchObject({ slug: 'frog' })
  })

  it('refuses when two items are almost as close (no clear lead)', () => {
    const twins = [
      { slug: 'shadow-dragon', names: ['Shadow Dragon'] },
      { slug: 'shadow-dragoon', names: ['Shadow Dragoon'] },
    ]
    expect(closeMatch('Shadow Dragan', twins).slug).toBeNull()
  })

  it('refuses a real but different name: Malaysian vs Malayan Tapir stays a suggestion', () => {
    const r = closeMatch('Malayan Tapir', [{ slug: 'malaysian-tapir', names: ['Malaysian Tapir'] }])
    expect(r.slug).toBeNull()
    expect(r.suggestions[0]).toMatchObject({ slug: 'malaysian-tapir' })
  })
})

describe('pairUnmatched: market names with no exact match vs items with no match yet', () => {
  const items = [
    { slug: 'woolly-rhino', names: ['Woolly Rhino'] },
    { slug: 'peacock', names: ['Peacock'] },
  ]

  it('pairs a misspelt market name with the one unclaimed item it is close to', () => {
    const { matched, unmatched } = pairUnmatched(['Wooly Rhino'], items, new Set())
    expect(matched).toEqual([{ marketName: 'Wooly Rhino', slug: 'woolly-rhino', score: expect.any(Number) }])
    expect(unmatched).toEqual([])
  })

  it('never moves listings onto an item that already has its own exact match', () => {
    // "Woolly Rhino" already matched exactly this run; a new "Wooly Rhinos"
    // group is a different (or new) item, not more listings for it.
    const { matched, unmatched } = pairUnmatched(['Wooly Rhinos'], items, new Set(['woolly-rhino']))
    expect(matched).toEqual([])
    expect(unmatched[0]).toMatchObject({ marketName: 'Wooly Rhinos' })
  })

  it('gives one item to at most one market name', () => {
    const { matched, unmatched } = pairUnmatched(['Wooly Rhino', 'Woolly Rhinoo'], items, new Set())
    expect(matched).toHaveLength(1)
    expect(unmatched).toHaveLength(1)
  })
})

import { planMarketNames } from '../../../scripts/lib/market-names.mjs'

describe('planMarketNames: the match log in a price run', () => {
  const items = [
    { slug: 'woolly-rhino', names: ['Woolly Rhino'] },
    { slug: 'peacock', names: ['Peacock'] },
    { slug: 'frost-dragon', names: ['Frost Dragon'] },
  ]
  const plan = (names: Record<string, number>, ledger: Record<string, object> = {}, claimed: string[] = []) =>
    planMarketNames({ game: 'adopt-me', names: new Map(Object.entries(names)), items, claimed: new Set(claimed), ledger: new Map(Object.entries(ledger)), now: 'T' })

  it('a saved decision wins: confirmed and auto map, rejected stays out', () => {
    const p = plan(
      { 'Peacok': 4, 'Peacock Egg': 2, 'Wooly Rhino': 3 },
      {
        Peacok: { status: 'confirmed', item_slug: 'peacock', score: null, suggestions: [] },
        'Peacock Egg': { status: 'rejected', item_slug: 'peacock', score: 0.9, suggestions: [] },
      },
    )
    expect([...p.mapped]).toEqual([
      ['Peacok', 'peacock'],
      ['Wooly Rhino', 'woolly-rhino'],
    ])
    expect(p.rows.find((r: { market_name: string }) => r.market_name === 'Peacock Egg')).toMatchObject({ status: 'rejected', offers: 2 })
  })

  it('a new close match is saved as auto; the rest as unmatched with suggestions and offers', () => {
    const p = plan({ 'Wooly Rhino': 3, 'Frost Dragoon Plushie': 7 })
    expect(p.autoMatched).toEqual([{ marketName: 'Wooly Rhino', slug: 'woolly-rhino', score: expect.any(Number) }])
    expect(p.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ market_name: 'Wooly Rhino', status: 'auto', item_slug: 'woolly-rhino', offers: 3 }),
        expect.objectContaining({ market_name: 'Frost Dragoon Plushie', status: 'unmatched', item_slug: null, offers: 7 }),
      ]),
    )
  })

  it('a saved match to an item that no longer exists is resolved afresh', () => {
    const p = plan({ 'Wooly Rhino': 1 }, { 'Wooly Rhino': { status: 'auto', item_slug: 'deleted-pet', score: 0.9, suggestions: [] } })
    expect(p.mapped.get('Wooly Rhino')).toBe('woolly-rhino')
  })
})

import { applyMarketNames } from '../../../scripts/lib/values-import.mjs'

describe('applyMarketNames (MM2): close matches stay inside the same type and form', () => {
  const catalogue = {
    entries: [
      { slug: 'emberbow', title: 'Emberbow', displayTitle: null, itemType: 'gun', isChroma: false, releaseYear: 2026 },
      { slug: 'chroma-emberbow', title: 'Chroma Emberbow', displayTitle: null, itemType: 'gun', isChroma: true, releaseYear: 2026 },
      { slug: 'emberscythe', title: 'Emberscythe (Knife)', displayTitle: 'Emberscythe', itemType: 'knife', isChroma: false, releaseYear: 2026 },
    ],
    idBySlug: new Map([['emberbow', 'id-bow'], ['chroma-emberbow', 'id-cbow'], ['emberscythe', 'id-scythe']]),
  }
  const row = (key: string, status = 'unmatched', slug: string | null = null) => ({ parse_status: status, matched_slug: slug, matched_item_id: null, match_confidence: null, _market_key: key })
  const exact = {
    rows: [row('gun|default|ember bow'), row('gun|chroma|ember bow'), row('knife|default|emberscyth'), row('gun|default|emberscythe')],
    stats: { total: 4, matched: 0, unmatched: 4, rejected: 0, ambiguous: 0, byVia: { title: 0, derived: 0, year: 0, alias: 0 } },
    unmatched: [
      { key: 'gun|default|ember bow', offers: 3, reputableOffers: 1 },
      { key: 'gun|chroma|ember bow', offers: 2, reputableOffers: 0 },
      { key: 'knife|default|emberscyth', offers: 1, reputableOffers: 0 },
      { key: 'gun|default|emberscythe', offers: 1, reputableOffers: 0 },
    ],
  }

  it('matches each spelling slip to the item of the same type and form, never across types', () => {
    const { plan, log } = applyMarketNames({ game: 'murder-mystery-2', plan: exact, catalogue, ledger: new Map(), now: 'T' })
    expect(plan.rows.map((r: { matched_slug: string | null }) => r.matched_slug)).toEqual(['emberbow', 'chroma-emberbow', 'emberscythe', null])
    expect(plan.rows[0]).toMatchObject({ parse_status: 'matched', matched_item_id: 'id-bow' })
    expect(plan.stats).toMatchObject({ matched: 3, unmatched: 1, byVia: { log: 3 } })
    // "Emberscythe" sold as a GUN is not the knife: it stays on the review list.
    expect(log.rows.find((r: { market_name: string }) => r.market_name === 'gun|default|emberscythe')).toMatchObject({ status: 'unmatched' })
  })
})
