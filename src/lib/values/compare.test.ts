import { describe, expect, it } from 'vitest'
import { nearestByValue, vsRows, vsVerdict, worthSameSentence, type CompareItem } from './compare'

const it_ = (key: string, priceUsd: number | null, facts?: CompareItem['facts'], tradePoints?: number | null): CompareItem => ({ key, name: key, href: `/x/${key}`, imageUrl: null, priceUsd, facts, tradePoints })

describe('nearestByValue', () => {
  it('closest by ratio, unpriced and excluded items skipped', () => {
    const items = [it_('a', 1), it_('b', 7.5), it_('c', 8.1), it_('d', 16), it_('e', null), it_('self', 7.7)]
    expect(nearestByValue(7.7, items, 3, new Set(['self'])).map((i) => i.key)).toEqual(['b', 'c', 'd'])
    expect(nearestByValue(null, items, 3)).toEqual([])
  })
})

describe('vsVerdict', () => {
  const a = it_('Harvester', 7.7)
  it('percent more or less, "about the same" within 3%, "N× as much" past double', () => {
    expect(vsVerdict(a, it_('Icewing', 6.8))).toBe('Icewing costs 12% less than Harvester ($6.80 vs $7.70).')
    expect(vsVerdict(a, it_('Luger', 7.8))).toBe('Luger and Harvester cost about the same ($7.80 vs $7.70).')
    expect(vsVerdict(a, it_('Corrupt', 20))).toBe('Corrupt costs about 2.6× as much as Harvester ($20.00 vs $7.70).')
    expect(vsVerdict(a, it_('X', null))).toBeNull()
  })
})

describe('worthSameSentence + vsRows', () => {
  it('names the picks', () => {
    expect(worthSameSentence('Harvester', [it_('Icewing', 1), it_('Luger', 1), it_('Gingerscope', 1)])).toBe('Harvester is worth about the same as Icewing, Luger and Gingerscope.')
    expect(worthSameSentence('Harvester', [])).toBeNull()
  })
  it('price, trade value, then the facts either has; a fact neither has is dropped', () => {
    const rows = vsRows(
      it_('A', 7.7, [{ label: 'Rarity', value: 'Ancient' }, { label: 'Released', value: '2021' }], 100),
      it_('B', 6.8, [{ label: 'Rarity', value: 'Godly' }, { label: 'Origin', value: 'Mystery Box 2' }], 88),
      (p) => String(Math.round(p)),
    )
    expect(rows).toEqual([
      { label: 'Price', a: '$7.70', b: '$6.80' },
      { label: 'Trade Value', a: '100', b: '88' },
      { label: 'Rarity', a: 'Ancient', b: 'Godly' },
      { label: 'Released', a: '2021', b: '—' },
      { label: 'Origin', a: '—', b: 'Mystery Box 2' },
    ])
  })
})
