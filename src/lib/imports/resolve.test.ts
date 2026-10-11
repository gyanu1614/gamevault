import { describe, it, expect } from 'vitest'
import { resolveRows, type ResolveContext } from './resolve'
import { parseImportInput } from './csv'
import { buildMatchIndex } from './match'
import { importConfigFor } from './config'
import { priceKey, type MarketPrice } from './types'
import type { CatalogueItem } from './types'

const item = (ref: string, name: string, imageUrl: string | null = null): CatalogueItem =>
  ({ ref, name, aliases: [], facts: { rarity: 'legendary' }, imageUrl })

const CATALOGUE = {
  items: [
    item('frost-dragon', 'Frost Dragon', 'https://x.test/frost.png'),
    item('shadow-dragon', 'Shadow Dragon', 'https://x.test/shadow.png'),
    item('owl', 'Owl'), // no catalogue art
  ],
  variants: [
    { ref: 'FR', label: 'Fly Ride' },
    { ref: 'NFR', label: 'Neon Fly Ride' },
  ],
}

const PRICES = new Map<string, MarketPrice>([
  [priceKey('frost-dragon', 'FR'), { usd: 10, estimated: false, sampleSize: 6 }],
  [priceKey('frost-dragon', 'NFR'), { usd: 25, estimated: false, sampleSize: 4 }],
  [priceKey('shadow-dragon', 'FR'), { usd: 8, estimated: true, sampleSize: 0 }],
  [priceKey('owl', null), { usd: 2, estimated: false, sampleSize: 3 }],
])

function ctx(over: Partial<ResolveContext> = {}): ResolveContext {
  return {
    config: importConfigFor('adopt-me')!,
    index: buildMatchIndex(CATALOGUE, []),
    prices: PRICES,
    pricingMode: 'auto',
    undercutPct: 10,
    allowEstimated: false,
    ...over,
  }
}

const run = (text: string, over: Partial<ResolveContext> = {}) =>
  resolveRows(parseImportInput(text).rows, ctx(over))

describe('a clean sheet', () => {
  const r = run('item,variant,quantity\nFrost Dragon,FR,3\nFrost Dragon,NFR,1')

  it('matches every row', () => {
    expect(r.summary).toMatchObject({ total: 2, matched: 2, unmatched: 0, ambiguous: 0, rejected: 0 })
  })

  it('prices from the market minus the undercut', () => {
    expect(r.rows[0].resolvedPrice).toBe(9)
    expect(r.rows[0].marketPrice).toBe(10)
    expect(r.rows[1].resolvedPrice).toBe(22.5)
  })

  it('carries the identity the listing is keyed on', () => {
    expect(r.rows[0]).toMatchObject({ itemRef: 'frost-dragon', variantRef: 'FR', quantity: 3 })
  })

  it('shows the exact title and description that will be written', () => {
    expect(r.rows[0].title).toBe('FR Frost Dragon | Adopt Me')
    expect(r.rows[0].description).toContain('Fly Ride (FR) Frost Dragon')
  })

  it('shows the catalogue thumbnail, and flags a row whose image comes later', () => {
    expect(r.rows[0].imageUrl).toBe('https://x.test/frost.png')
    expect(r.rows[0].imagePending).toBe(false)
    const owl = run('item,quantity\nOwl,1')
    expect(owl.rows[0].imagePending).toBe(true)
    expect(owl.summary.imagesPending).toBe(1)
  })
})

describe('quantity', () => {
  it('defaults to 1 when the cell is empty', () => {
    expect(run('item,variant\nFrost Dragon,FR').rows[0].quantity).toBe(1)
  })

  it('honours a batch default', () => {
    expect(run('item,variant\nFrost Dragon,FR', { defaultQuantity: 5 }).rows[0].quantity).toBe(5)
  })

  it('rejects a zero or negative quantity', () => {
    const r = run('item,variant,quantity\nFrost Dragon,FR,0')
    expect(r.rows[0]).toMatchObject({ status: 'rejected' })
    expect(r.rows[0].error).toMatch(/1 or more/)
  })
})

describe('pricing', () => {
  it('uses a price in the sheet over the batch mode', () => {
    const r = run('item,variant,quantity,price\nFrost Dragon,FR,1,4.99')
    expect(r.rows[0]).toMatchObject({ priceMode: 'explicit', resolvedPrice: 4.99 })
  })

  it('warns but still applies when a sheet price is far off the market', () => {
    const r = run('item,variant,quantity,price\nFrost Dragon,FR,1,99')
    expect(r.rows[0].status).toBe('matched')
    expect(r.rows[0].warning).toMatch(/above the market/)
    expect(r.summary.warnings).toBe(1)
  })

  it('rejects an auto row with no market price — never invents one', () => {
    const noPrice = new Map(PRICES)
    noPrice.delete(priceKey('frost-dragon', 'FR'))
    const r = run('item,variant,quantity\nFrost Dragon,FR,1', { prices: noPrice })
    expect(r.rows[0]).toMatchObject({ status: 'rejected', resolvedPrice: null })
    expect(r.rows[0].error).toMatch(/no market price/)
  })

  it('rejects an auto row whose only value is an estimate, unless opted in', () => {
    const r = run('item,variant,quantity\nShadow Dragon,FR,1')
    expect(r.rows[0].status).toBe('rejected')
    expect(r.rows[0].error).toMatch(/estimate/)

    const opted = run('item,variant,quantity\nShadow Dragon,FR,1', { allowEstimated: true })
    expect(opted.rows[0]).toMatchObject({ status: 'matched', resolvedPrice: 7.2 })
    expect(opted.rows[0].warning).toMatch(/estimated/)
  })

  it('rejects a row with no price when the batch prices from the sheet', () => {
    const r = run('item,variant,quantity\nFrost Dragon,FR,1', { pricingMode: 'explicit' })
    expect(r.rows[0].status).toBe('rejected')
    expect(r.rows[0].error).toMatch(/no price/)
  })
})

describe('rows that need a human', () => {
  it('flags an unknown item with its closest candidates, and keeps the row', () => {
    const r = run('item,variant,quantity\nFrst Dragn,FR,1')
    expect(r.rows[0].status).not.toBe('matched')
    expect(r.rows[0].error).toMatch(/no pet in the catalogue matches/)
    expect(r.rows).toHaveLength(1)
  })

  it('flags an ambiguous item rather than picking one', () => {
    const twins = buildMatchIndex(
      { items: [item('dragon-alpha', 'Dragon Alpha'), item('dragon-beta', 'Dragon Beta')], variants: CATALOGUE.variants },
      [],
    )
    const r = run('item,variant,quantity\nDragon,FR,1', { index: twins })
    expect(r.rows[0].status).toBe('ambiguous')
    expect(r.rows[0].candidates.length).toBeGreaterThan(1)
    expect(r.rows[0].error).toMatch(/could be more than one pet/)
  })

  it('rejects a variant this game does not have', () => {
    const r = run('item,variant,quantity\nFrost Dragon,Rideable,1')
    expect(r.rows[0].status).toBe('rejected')
    expect(r.rows[0].error).toMatch(/not a variant this game has/)
  })

  it('keeps an empty item row and says what is wrong', () => {
    const r = run('item,variant,quantity\n,FR,1')
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].error).toMatch(/no item name/)
  })

  it('never loses a row, whatever its state', () => {
    const r = run([
      'item,variant,quantity,price',
      'Frost Dragon,FR,2,',       // matched, auto
      'Frost Dragon,NFR,1,30',    // matched, explicit + warning band
      'Nonsense Item,,1,',        // unmatched
      'Frost Dragon,Rideable,1,', // rejected variant
      ',,1,',                     // no name
      'Shadow Dragon,FR,1,',      // rejected estimate
    ].join('\n'))
    expect(r.summary.total).toBe(6)
    expect(r.rows.map((x) => x.rowNo)).toEqual([1, 2, 3, 4, 5, 6])
    expect(r.summary.matched + r.summary.unmatched + r.summary.ambiguous + r.summary.rejected).toBe(6)
  })
})

describe('a sheet that lists the same thing twice', () => {
  it('rejects the second occurrence and points at the first', () => {
    const r = run('item,variant,quantity\nFrost Dragon,FR,2\nfrost dragon,fr,5')
    expect(r.rows[0].status).toBe('matched')
    expect(r.rows[1].status).toBe('rejected')
    expect(r.rows[1].error).toMatch(/same pet and variant as row 1/)
    expect(r.summary.duplicates).toBe(1)
  })

  it('treats two variants of one item as different things', () => {
    const r = run('item,variant,quantity\nFrost Dragon,FR,1\nFrost Dragon,NFR,1')
    expect(r.summary).toMatchObject({ matched: 2, duplicates: 0 })
  })
})

describe('a game with no variant axis', () => {
  it('ignores the variant cell entirely', () => {
    const sae = importConfigFor('steal-an-egg')!
    const index = buildMatchIndex({ items: [item('jungle-egg', 'Jungle Egg')], variants: [] }, [])
    const prices = new Map<string, MarketPrice>([[priceKey('jungle-egg', null), { usd: 1, estimated: false }]])
    const r = resolveRows(parseImportInput('item,variant,quantity\nJungle Egg,whatever,4').rows, ctx({ config: sae, index, prices }))
    expect(r.rows[0]).toMatchObject({ status: 'matched', variantRef: null, quantity: 4 })
    expect(r.rows[0].title).toBe('Jungle Egg | Steal An Egg')
  })
})
