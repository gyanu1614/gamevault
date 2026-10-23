import { describe, it, expect } from 'vitest'
import { justAdded, mostValuable, sellItemsFromAdoptMe, sellItemsFromSab, sellItemsFromValueItems, sellItemsFromValueRows, topToSell, type SellItem } from './sell-items'
import type { BrainrotDirectoryItem } from '@/app/(marketplace)/[gameSlug]/values/_sabListModel'
import type { AdoptMePetItem } from '@/app/(marketplace)/[gameSlug]/values/_adoptMeListModel'
import type { ValueListRow } from '@/app/(marketplace)/[gameSlug]/values/_generic/valueListModel'
import type { ValueItem } from '@/lib/values/data'

const DAY = 86_400_000
const brainrot = (slug: string, extra: Partial<BrainrotDirectoryItem> = {}): BrainrotDirectoryItem => ({
  id: slug,
  name: slug,
  slug,
  rarity: 'Secret',
  obtainability: 'obtainable',
  base_income_per_second: null,
  image_url: `https://x/${slug}.webp`,
  display_price_usd: null,
  display_price_label: '',
  display_price_source: '',
  confidence_label: '',
  ...extra,
})

describe('sell rows: the one price rule (our listing, else the market)', () => {
  it('SAB: our live listing beats the market; the market otherwise; nothing when neither', () => {
    const rows = sellItemsFromSab(
      [brainrot('a', { average_usd: 40, popularity_rank: 2, isNew: true }), brainrot('b', { display_price_usd: '12.5' }), brainrot('c')],
      { a: { total: 2, minPriceUsd: 35, byVariant: {} } },
    )
    expect(rows.map((r) => [r.slug, r.priceUsd, r.demand, r.isNew])).toEqual([
      ['a', 35, 2, true],
      ['b', 12.5, null, false],
      ['c', null, null, false],
    ])
    expect(rows[0].href).toBe('/steal-a-brainrot/values/a')
  })

  it('Adopt Me: quotes the Fly Ride form, and only a Fly Ride listing replaces its market price', () => {
    const pet = (slug: string, values: AdoptMePetItem['values']): AdoptMePetItem => ({
      slug, name: slug, rarity: 'legendary', imageUrl: null, topTradeValue: 0, demandRank: 1, hasPage: true, values,
    })
    const v = (cashUsd: number | null) => ({ variant: 'FR' as const, tradeValue: null, cashUsd, cheapestUsd: null, averageUsd: null, isEstimated: false, confidence: 'high' })
    const key = (code: string) => ({ FR: 'fly-ride', N: 'normal' })[code] ?? null
    const rows = sellItemsFromAdoptMe(
      [pet('bat-dragon', { FR: v(300) } as AdoptMePetItem['values']), pet('owl', { N: { ...v(20), variant: 'N' } } as AdoptMePetItem['values'])],
      {
        'bat-dragon': { total: 1, minPriceUsd: 90, byVariant: { normal: { count: 1, minPriceUsd: 90 } } },
        owl: { total: 1, minPriceUsd: 15, byVariant: { normal: { count: 1, minPriceUsd: 15 } } },
      },
      key,
    )
    expect(rows.map((r) => [r.slug, r.form, r.priceUsd])).toEqual([
      ['bat-dragon', 'Fly Ride', 300],
      ['owl', 'Normal', 15],
    ])
  })

  it('values_items games: demand is the rank by reputable listings tracked', () => {
    const row = (id: string, listedNow: number, marketUsd: number | null): ValueListRow => ({
      id, slug: id, name: id, rarity: null, itemType: null, imageUrl: null, href: null, cheapestUsd: null, marketUsd, listedNow, trendPct: null, baseItemId: null,
    })
    const rows = sellItemsFromValueRows('murder-mystery-2', [row('a', 3, 10), row('b', 40, 5), row('c', 0, null)], {})
    expect(rows.map((r) => [r.slug, r.demand, r.href])).toEqual([
      ['a', 2, '/murder-mystery-2/values/a'],
      ['b', 1, '/murder-mystery-2/values/b'],
      ['c', null, '/murder-mystery-2/values/c'],
    ])
  })

  it('Steal an Egg (ValueItems): New from the date the row was added', () => {
    const item = (slug: string, addedAt: string): ValueItem =>
      ({ id: slug, slug, name: slug, imageUrl: null, itemType: null, rarity: null, baseItemId: null, addedAt, price: null }) as unknown as ValueItem
    const now = Date.parse('2026-10-22T00:00:00Z')
    const rows = sellItemsFromValueItems('steal-an-egg', [item('new-pet', new Date(now - DAY).toISOString()), item('old-pet', '2026-01-01T00:00:00Z')], {}, now)
    expect(rows.map((r) => [r.slug, r.isNew, r.priceUsd])).toEqual([
      ['new-pet', true, null],
      ['old-pet', false, null],
    ])
  })
})

describe('sell sections', () => {
  const it_ = (slug: string, priceUsd: number | null, demand: number | null, isNew = false): SellItem => ({
    slug, name: slug, imageUrl: null, priceUsd, form: null, demand, isNew, href: `/g/values/${slug}`,
  })
  const items = [it_('cheap-popular', 2, 1), it_('pricey', 500, null), it_('mid', 50, 3), it_('unpriced', null, 2, true), it_('new-priced', 80, null, true)]

  it('Top To Sell Now: priced only, most in demand first, then by price', () => {
    expect(topToSell(items).map((i) => i.slug)).toEqual(['cheap-popular', 'mid', 'pricey', 'new-priced'])
    expect(topToSell(items, 2)).toHaveLength(2)
  })

  it('Just Added: new items, priced first', () => {
    expect(justAdded(items).map((i) => i.slug)).toEqual(['new-priced', 'unpriced'])
  })

  it('most valuable: by price', () => {
    expect(mostValuable(items, 3).map((i) => i.slug)).toEqual(['pricey', 'new-priced', 'mid'])
  })
})
