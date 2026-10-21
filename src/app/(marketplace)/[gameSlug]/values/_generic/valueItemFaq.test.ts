import { describe, expect, it } from 'vitest'
import type { ValueItem } from '@/lib/values/data'
import { valueItemFaq } from './valueItemFaq'

const item = (o: Partial<ValueItem>): ValueItem => ({ id: o.slug ?? 'x', slug: 'x', name: 'X', kind: 'pet', rarity: null, area: null, incomePerSec: null, sourceItemId: null, price: null, ...o }) as ValueItem

const egg = item({ id: 'e1', slug: 'aetheron-egg', name: 'Aetheron Egg', kind: 'egg', area: 'Angels', price: { cheapestUsd: 1.2, averageUsd: 1.5, sampleSize: 14 } as ValueItem['price'] })
const pet = item({ id: 'p1', slug: 'aetheron', name: 'Aetheron', kind: 'pet', area: 'Angels', sourceItemId: 'e1' })
const area = item({ id: 'a1', slug: 'angels', name: 'Angels', kind: 'area' })
const items = [egg, pet, area]

describe('valueItemFaq', () => {
  it('an unpriced pet: not sold alone, the egg it hatches from and its price, how to get it', () => {
    const f = valueItemFaq({ item: pet, gameName: 'Steal an Egg', items, income: '6.9B/s' })
    expect(f.map((x) => x.q)).toEqual([
      'How much is Aetheron worth in Steal an Egg?',
      'How do you get Aetheron in Steal an Egg?',
      'How much money does Aetheron make in Steal an Egg?',
    ])
    expect(f[0].a).toBe("Aetheron isn't sold on its own: the market sells eggs, and Aetheron hatches from the Aetheron Egg. The Aetheron Egg sells for about $1.20.")
    expect(f[1].a).toMatch(/^Aetheron hatches from the Aetheron Egg, found in the Angels area\./)
  })
  it('a priced egg: its price from live listings and what hatches from it', () => {
    const f = valueItemFaq({ item: egg, gameName: 'Steal an Egg', items, income: null })
    expect(f[0].a).toBe('Aetheron Egg sells for about $1.20, the cheapest of 14 live listings we track; the typical price is $1.50.')
    expect(f[1]).toEqual({ q: 'What hatches from the Aetheron Egg?', a: 'The Aetheron Egg hatches Aetheron.' })
  })
  it('an area lists its eggs; nothing is invented for what we do not know', () => {
    expect(valueItemFaq({ item: area, gameName: 'Steal an Egg', items, income: null })).toEqual([
      { q: 'Which eggs are in the Angels area?', a: 'The Angels area has Aetheron Egg.' },
      { q: 'Which pets come from the Angels area?', a: 'Pets from the Angels area include Aetheron.' },
    ])
    expect(valueItemFaq({ item: item({}), gameName: 'G', items: [], income: null })).toEqual([])
  })
})
