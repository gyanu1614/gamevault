import { describe, it, expect } from 'vitest'
import { pickMovers } from './movers'
import type { FeedItem } from '../types'

const m = (slug: string, pct: number | null, valueUsd: number | null = 10, trendLabel: string | null = null): FeedItem => ({
  slug,
  name: slug,
  imageUrl: null,
  href: `/x/values/${slug}`,
  rarityKey: null,
  itemType: null,
  isNew: false,
  trendPct: pct,
  trendLabel,
  valueUsd,
})

describe('pickMovers', () => {
  it('splits rising and falling, biggest move first', () => {
    const r = pickMovers([m('a', 2), m('b', 9), m('c', -4), m('d', -1)])!
    expect(r.rising.map((x) => x.slug)).toEqual(['b', 'a'])
    expect(r.falling.map((x) => x.slug)).toEqual(['c', 'd'])
  })

  it('keeps the form label and the value page on each row', () => {
    const r = pickMovers([m('frost', 6.8, 89.99, 'FR'), m('crow', -3.4)])!
    expect(r.rising[0]).toEqual({ slug: 'frost', name: 'frost', imageUrl: null, href: '/x/values/frost', pct: 6.8, label: 'FR' })
  })

  it('caps each side', () => {
    const r = pickMovers([m('a', 1), m('b', 2), m('c', 3), m('d', 4)], 3)!
    expect(r.rising).toHaveLength(3)
  })

  it('ignores penny items so a $0.01 to $0.03 jump does not lead', () => {
    expect(pickMovers([m('penny', 200, 0.03), m('a', 2), m('b', -3)])!.rising.map((x) => x.slug)).toEqual(['a'])
  })

  it('ignores moves under the trend floor', () => {
    expect(pickMovers([m('tiny', 0.01), m('a', 2), m('b', -3)])!.rising.map((x) => x.slug)).toEqual(['a'])
  })

  it('is null when fewer than two items moved', () => {
    expect(pickMovers([m('a', 3), m('b', null)])).toBeNull()
  })
})
