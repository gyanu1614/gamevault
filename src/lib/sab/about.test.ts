import { describe, expect, it } from 'vitest'
import { sabAbout, sabMetaTail } from './about'
import { NO_FACTS } from '@/lib/values/item-facts'

const how = (status: 'obtainable' | 'unobtainable') => ({ status, method: 'x', costs: null, odds: null, released: null, note: null, sources: [], confidence: 'medium' as const, checkedAt: '2026-10-19' })

describe('sabAbout', () => {
  it('reads from the brainrot’s own facts', () => {
    expect(
      sabAbout({ name: 'La Grande Combinasion', rarity: 'Secret', income: '$10M/s', cost: '$1B', obtainability: 'obtainable', facts: { released: '21 June 2025', origin: 'Admin Abuse events', howToGet: how('obtainable') } }),
    ).toBe(
      'La Grande Combinasion is a Secret brainrot in Steal a Brainrot, added on 21 June 2025. It makes $10M/s and costs $1B in-game cash. It comes from Admin Abuse events. It can still be obtained in-game. Each mutation multiplies its base income, and the mutation prices below come from real listings.',
    )
  })
  it('a Red Carpet brainrot says where the cost is paid; an unobtainable one says how to get it now', () => {
    const s = sabAbout({ name: 'Tim Cheese', rarity: 'Rare', income: '$5/s', cost: '$500', obtainability: 'obtainable', facts: { released: null, origin: 'Red Carpet', howToGet: how('unobtainable') } })
    expect(s).toContain('costs $500 in-game cash on the Red Carpet.')
    expect(s).not.toContain('It comes from')
    expect(s).toContain('can no longer be obtained in-game')
  })
  it('with no facts it still differs from the old template: no "obtainability status is"', () => {
    const s = sabAbout({ name: 'X', rarity: 'OG', income: '$1B/s', cost: null, obtainability: 'limited', facts: NO_FACTS })
    expect(s).toMatch(/^X is an OG brainrot in Steal a Brainrot\. It makes \$1B\/s\. It is a limited brainrot/)
    expect(s).not.toMatch(/obtainability status/)
    expect(sabAbout({ name: 'Y', rarity: 'Rare', income: null, cost: null, obtainability: 'x', facts: NO_FACTS })).toBe(
      'Y is a Rare brainrot in Steal a Brainrot. Each mutation multiplies its base income, and the mutation prices below come from real listings.',
    )
  })
})

describe('sabMetaTail', () => {
  it('the longest version that fits', () => {
    expect(sabMetaTail({ rarity: 'Secret', released: '21 June 2025' })).toBe('A Secret brainrot, added 21 June 2025. How to get it, mutation prices and safe offers.')
    expect(sabMetaTail({ rarity: 'Secret', released: '21 June 2025' }, 70)).toBe('Secret brainrot: how to get it, mutation prices and safe offers.')
    expect(sabMetaTail({ rarity: 'Secret', released: null }, 10)).toBe('How to get it, mutation prices and safe offers.')
  })
})
