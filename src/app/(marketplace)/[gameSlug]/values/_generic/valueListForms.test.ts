import { describe, it, expect } from 'vitest'
import { collapseForms, pairForms, type ValueListRow } from './valueListModel'

const row = (id: string, name: string, rarity: string, baseItemId: string | null = null): ValueListRow => ({
  id,
  slug: id,
  name,
  rarity,
  itemType: 'gun',
  imageUrl: null,
  href: `/murder-mystery-2/values/${id}`,
  cheapestUsd: 10,
  marketUsd: 12,
  listedNow: 3,
  trendPct: null,
  baseItemId,
})

// Owner, 2026-10-14: MM2 cards get a Standard / Chroma choice (like Adopt Me's
// Normal / Neon) for every item that exists in both forms.
describe('pairForms', () => {
  const travelers = row('travelers-gun', "Traveler's Gun", 'Godly')
  const chroma = row('chroma-travelers-gun', "Chroma Traveler's Gun", 'Chroma', 'travelers-gun')
  const lone = row('seer', 'Seer', 'Godly')
  const orphan = row('chroma-gone', 'Chroma Gone', 'Chroma', 'not-in-list')

  it('links a Chroma and its base item both ways', () => {
    const forms = pairForms([travelers, chroma, lone, orphan])
    expect(forms.get('travelers-gun')).toEqual({ standard: travelers, chroma })
    expect(forms.get('chroma-travelers-gun')).toEqual({ standard: travelers, chroma })
  })

  it('leaves items with one form alone (no switch)', () => {
    const forms = pairForms([travelers, chroma, lone, orphan])
    expect(forms.has('seer')).toBe(false)
    expect(forms.has('chroma-gone')).toBe(false)
  })
})

// Owner, 2026-10-21: one card per item. A Chroma whose standard item is in the
// same list rides on that card (the flip button); every row keeps its page.
describe('collapseForms', () => {
  const emberbow = row('emberbow', 'Emberbow', 'Ancient')
  const chromaEmberbow = row('chroma-emberbow', 'Chroma Emberbow', 'Chroma', 'emberbow')
  const seer = row('seer', 'Seer', 'Godly')
  const orphan = row('chroma-gone', 'Chroma Gone', 'Chroma', 'not-in-list')

  it('drops a Chroma whose base is in the list, keeping order', () => {
    expect(collapseForms([chromaEmberbow, emberbow, seer]).map((r) => r.id)).toEqual(['emberbow', 'seer'])
  })
  it('keeps a Chroma on its own when its base is filtered out (Chroma tab, a "chroma" search)', () => {
    expect(collapseForms([chromaEmberbow, orphan]).map((r) => r.id)).toEqual(['chroma-emberbow', 'chroma-gone'])
  })
})
