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

// ── Category pages and value items (Bundle 1, task 4) ───────────────────────
// ONE verdict decides both the page's robots meta and the sitemap entry.
import {
  MIN_VALUE_SAMPLE_SIZE,
  categoryPageVerdict,
  hasCuratedCurrencyContent,
  isCategoryPageIndexable,
  isValueItemIndexable,
} from './indexability'

describe('hasCuratedCurrencyContent', () => {
  it('is true with a non-empty FAQ or steps list', () => {
    expect(hasCuratedCurrencyContent({ faq: [{}], steps: [] })).toBe(true)
    expect(hasCuratedCurrencyContent({ faq: [], steps: [{}] })).toBe(true)
  })
  it('is false for no config, an empty config, or empty lists (a default config row is not curation)', () => {
    expect(hasCuratedCurrencyContent(null)).toBe(false)
    expect(hasCuratedCurrencyContent(undefined)).toBe(false)
    expect(hasCuratedCurrencyContent({})).toBe(false)
    expect(hasCuratedCurrencyContent({ faq: [], steps: [] })).toBe(false)
    expect(hasCuratedCurrencyContent({ faq: null, steps: null })).toBe(false)
  })
})

describe('isCategoryPageIndexable', () => {
  it('needs a buyable listing or curated content', () => {
    expect(isCategoryPageIndexable({ buyableListingCount: 0, hasCuratedContent: false })).toBe(false)
    expect(isCategoryPageIndexable({ buyableListingCount: 1, hasCuratedContent: false })).toBe(true)
    expect(isCategoryPageIndexable({ buyableListingCount: 0, hasCuratedContent: true })).toBe(true)
  })
})

describe('categoryPageVerdict', () => {
  const base = {
    gameActive: true,
    categoryEnabled: true,
    categoryBelongsToGame: true,
    buyableListingCount: 3,
    hasCuratedContent: false,
  }
  it('indexes an enabled category with buyable listings', () => {
    expect(categoryPageVerdict(base)).toBe('index')
  })
  it('noindexes an empty category with no curated content (the page still renders)', () => {
    expect(categoryPageVerdict({ ...base, buyableListingCount: 0 })).toBe('noindex')
  })
  it('indexes an empty category with curated content', () => {
    expect(categoryPageVerdict({ ...base, buyableListingCount: 0, hasCuratedContent: true })).toBe('index')
  })
  it.each([
    ['an inactive game', { gameActive: false }],
    ['a disabled category (the /gta-vi/buy-items case: listed but 404)', { categoryEnabled: false }],
    ['a category that belongs to another game', { categoryBelongsToGame: false }],
  ])('is not-found for %s, whatever the listings say', (_label, override) => {
    expect(categoryPageVerdict({ ...base, ...override })).toBe('not-found')
  })
})

describe('isValueItemIndexable', () => {
  it('needs a price backed by at least the minimum number of live listings', () => {
    expect(MIN_VALUE_SAMPLE_SIZE).toBe(3)
    expect(isValueItemIndexable({ priced: true, sampleSize: 3 })).toBe(true)
    expect(isValueItemIndexable({ priced: true, sampleSize: 2 })).toBe(false)
    expect(isValueItemIndexable({ priced: false, sampleSize: 50 })).toBe(false)
    expect(isValueItemIndexable({ priced: true, sampleSize: null })).toBe(false)
  })
})

// ── The value-page data gate (growth point 28) ──────────────────────────────
import {
  passesValueDataGate,
  valuePageVerdict,
  VALUE_GATE_MIN_HISTORY_DAYS,
  VALUE_GATE_MIN_OBSERVATIONS,
  type ValuePageIndexInput,
} from './indexability'

describe('passesValueDataGate', () => {
  it('is 5 offers we track and 7 days of history, owner-approved 2026-10-09', () => {
    expect(VALUE_GATE_MIN_OBSERVATIONS).toBe(5)
    expect(VALUE_GATE_MIN_HISTORY_DAYS).toBe(7)
  })

  it('needs a price, enough offers AND enough history', () => {
    const ok = { valueUsd: 42, observations: 5, historyDays: 7 }
    expect(passesValueDataGate(ok)).toBe(true)
    expect(passesValueDataGate({ ...ok, observations: 4 })).toBe(false)
    expect(passesValueDataGate({ ...ok, historyDays: 6 })).toBe(false)
    expect(passesValueDataGate({ ...ok, valueUsd: null })).toBe(false)
  })
})

describe('valuePageVerdict', () => {
  const evidence = { valueUsd: 42, observations: 18, historyDays: 30, isProtected: false }
  const thin = { valueUsd: 1.18, observations: 1, historyDays: 72, isProtected: false }
  const v = (o: Partial<ValuePageIndexInput>) =>
    valuePageVerdict({ legacyIndexable: true, evidence, mode: 'enforce', override: null, ...o })

  it('indexes a page that passes the gate', () => {
    expect(v({})).toEqual({ index: true, reason: 'passes' })
  })

  it('noindexes a page that fails the gate once enforced', () => {
    expect(v({ evidence: thin })).toEqual({ index: false, reason: 'fails-gate' })
  })

  it('changes nothing in report mode: a failing page stays indexable', () => {
    expect(v({ evidence: thin, mode: 'report' })).toEqual({ index: true, reason: 'report-only' })
    expect(v({ evidence: null, mode: 'report' })).toEqual({ index: true, reason: 'report-only' })
  })

  it('never hides a page Google has indexed or that earned clicks, even when enforced', () => {
    expect(v({ evidence: { ...thin, isProtected: true } })).toEqual({ index: true, reason: 'protected' })
  })

  it('treats a page with no evidence row yet as failing once enforced', () => {
    expect(v({ evidence: null })).toEqual({ index: false, reason: 'no-evidence' })
  })

  it('keeps the old per-source rule: a page that was noindex stays noindex in either mode', () => {
    expect(v({ legacyIndexable: false, mode: 'report' })).toEqual({ index: false, reason: 'legacy' })
    expect(v({ legacyIndexable: false })).toEqual({ index: false, reason: 'legacy' })
  })

  it("lets the owner's explicit decision win over everything", () => {
    expect(v({ override: 'noindex' })).toEqual({ index: false, reason: 'override' })
    expect(v({ override: 'noindex', mode: 'report', evidence: { ...thin, isProtected: true } })).toEqual({ index: false, reason: 'override' })
    expect(v({ override: 'index', evidence: thin, legacyIndexable: false })).toEqual({ index: true, reason: 'override' })
  })
})
