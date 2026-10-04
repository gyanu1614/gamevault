import { describe, it, expect } from 'vitest'
import { resolveBuyState, itemBuyHref, buyCtaCopy, type ItemStock } from './buy-state'

const stock = (byVariant: Record<string, [count: number, min: number]>, unknown?: [number, number]): ItemStock => {
  const entries = Object.entries(byVariant).map(([k, [count, minPriceUsd]]) => [k, { count, minPriceUsd }] as const)
  const all = [...entries.map(([, v]) => v), ...(unknown ? [{ count: unknown[0], minPriceUsd: unknown[1] }] : [])]
  return {
    total: all.reduce((n, v) => n + v.count, 0),
    minPriceUsd: all.length ? Math.min(...all.map((v) => v.minPriceUsd)) : null,
    byVariant: Object.fromEntries(entries),
  }
}

const base = { gameSlug: 'steal-a-brainrot', categorySlug: 'buy-items', itemSlug: 'dragon-cannelloni' }

describe('itemBuyHref', () => {
  it('builds item and variant paths', () => {
    expect(itemBuyHref(base)).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni')
    expect(itemBuyHref({ ...base, variant: 'diamond' })).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni/diamond')
  })
})

describe('resolveBuyState', () => {
  it('state 1: the chosen variant is in stock → its own cheapest price + variant page', () => {
    expect(resolveBuyState({ ...base, variant: 'gold', stock: stock({ gold: [2, 4.5], default: [1, 1.2] }) })).toEqual({
      kind: 'in_stock',
      priceUsd: 4.5,
      count: 2,
      href: '/steal-a-brainrot/buy-items/item/dragon-cannelloni/gold',
    })
  })

  it('state 2: variant out, others listed → count + cheapest of the others + item page', () => {
    expect(resolveBuyState({ ...base, variant: 'diamond', stock: stock({ gold: [2, 4.5], default: [1, 1.2] }) })).toEqual({
      kind: 'other_variants',
      priceUsd: 1.2,
      count: 3,
      href: '/steal-a-brainrot/buy-items/item/dragon-cannelloni',
    })
  })

  it('state 2 counts listings whose variant is unknown', () => {
    const s = resolveBuyState({ ...base, variant: 'neon', stock: stock({}, [1, 30]) })
    expect(s).toMatchObject({ kind: 'other_variants', count: 1, priceUsd: 30 })
  })

  it('state 3: nothing listed → similar items link (item page) + sell', () => {
    expect(resolveBuyState({ ...base, variant: 'gold', stock: stock({}) })).toEqual({
      kind: 'none',
      similarHref: '/steal-a-brainrot/buy-items/item/dragon-cannelloni',
    })
    expect(resolveBuyState({ ...base, variant: 'gold', stock: null })).toMatchObject({ kind: 'none' })
  })

  it('item level (no variant chosen): any stock is state 1 on the item page', () => {
    expect(resolveBuyState({ ...base, variant: null, stock: stock({ gold: [2, 4.5] }, [1, 3]) })).toEqual({
      kind: 'in_stock',
      priceUsd: 3,
      count: 3,
      href: '/steal-a-brainrot/buy-items/item/dragon-cannelloni',
    })
  })
})

describe('buyCtaCopy', () => {
  it('state 1: "Buy From $X" with cents', () => {
    expect(buyCtaCopy({ kind: 'in_stock', priceUsd: 10.95, count: 2, href: '/x' }, 'Diamond')).toEqual({ label: 'Buy From $10.95', subline: null })
  })
  it('state 2: count + cheapest + which variant is missing', () => {
    expect(buyCtaCopy({ kind: 'other_variants', priceUsd: 4, count: 3, href: '/x' }, 'Diamond')).toEqual({
      label: 'See 3 Other Listings From $4',
      subline: 'Diamond not listed right now',
    })
    expect(buyCtaCopy({ kind: 'other_variants', priceUsd: 0.62, count: 1, href: '/x' }, 'Neon').label).toBe('See 1 Other Listing From $0.62')
  })
  it('state 3: browse similar (alerts come with task D)', () => {
    expect(buyCtaCopy({ kind: 'none', similarHref: '/x' }, 'Diamond')).toEqual({ label: 'Browse Similar Items', subline: null })
  })
})
