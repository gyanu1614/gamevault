import { describe, it, expect } from 'vitest'
import { isGameHubIndexable, isGameSellPageIndexable } from './indexability'

const hub = (o: Partial<Parameters<typeof isGameHubIndexable>[0]> = {}) =>
  isGameHubIndexable({
    contentTier: 'listed',
    activeListingCount: 0,
    hasCuratedCurrencyConfig: false,
    seoIndexable: null,
    ...o,
  })

describe('isGameHubIndexable', () => {
  it('keeps a zero-inventory listed hub OUT of the index', () => {
    expect(hub()).toBe(false)
  })

  it('indexes a listed hub once it has real inventory', () => {
    expect(hub({ activeListingCount: 1 })).toBe(true)
  })

  it('indexes a data-tier hub with no inventory', () => {
    expect(hub({ contentTier: 'data' })).toBe(true)
  })

  it('indexes a hub with a curated currency config', () => {
    expect(hub({ hasCuratedCurrencyConfig: true })).toBe(true)
  })

  it('lets an admin override force a thin hub in', () => {
    expect(hub({ seoIndexable: true })).toBe(true)
  })

  it('lets an admin override force a stocked hub out', () => {
    expect(hub({ seoIndexable: false, activeListingCount: 50 })).toBe(false)
  })

  it('treats a null override as "no opinion", not false', () => {
    expect(hub({ seoIndexable: null, activeListingCount: 3 })).toBe(true)
  })

  it('does not index on content_tier values other than data', () => {
    expect(hub({ contentTier: 'listed' })).toBe(false)
    expect(hub({ contentTier: null })).toBe(false)
  })
})

describe('isGameSellPageIndexable', () => {
  it('indexes a sell page with categories and zero inventory', () => {
    expect(isGameSellPageIndexable({ enabledCategoryCount: 2 })).toBe(true)
  })

  it('does not index a sell page with no enabled categories', () => {
    expect(isGameSellPageIndexable({ enabledCategoryCount: 0 })).toBe(false)
  })

  it('respects an explicit admin noindex', () => {
    expect(
      isGameSellPageIndexable({ enabledCategoryCount: 3, seoIndexable: false }),
    ).toBe(false)
  })
})

describe('hub and sell rules differ where the decision intends', () => {
  it('a seeded zero-inventory game: hub noindex, sell page indexable', () => {
    expect(hub()).toBe(false)
    expect(isGameSellPageIndexable({ enabledCategoryCount: 3 })).toBe(true)
  })
})
