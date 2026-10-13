import { describe, expect, it } from 'vitest'
import { topValuesFromItems } from './_genericTopValues'

const item = (slug: string, cheapestUsd: number | null, sampleSize = 5) =>
  ({ slug, name: slug.toUpperCase(), imageUrl: `/${slug}.png`, price: cheapestUsd == null ? null : { cheapestUsd, averageUsd: null, lowUsd: null, highUsd: null, sampleSize, sourceCount: 1, confidenceLabel: null, priceChangedAt: null } }) as any

describe('topValuesFromItems (blog Live Values for value-pipeline games)', () => {
  it('priced items only, dearest first, capped', () => {
    const out = topValuesFromItems([item('a', 3), item('b', null), item('c', 120.5), item('d', 40)], 2)
    expect(out.map((o) => o.slug)).toEqual(['c', 'd'])
    expect(out[0]).toEqual({ name: 'C', slug: 'c', imageUrl: '/c.png', priceLabel: '$120.50', qualifier: '5 live listings', changePct: null })
  })
  it('one listing reads singular; nothing priced → empty', () => {
    expect(topValuesFromItems([item('x', 9, 1)], 4)[0].qualifier).toBe('1 live listing')
    expect(topValuesFromItems([item('y', null)], 4)).toEqual([])
  })
})
