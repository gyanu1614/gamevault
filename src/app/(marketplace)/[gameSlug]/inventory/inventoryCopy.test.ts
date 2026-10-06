import { describe, expect, it } from 'vitest'
import { faq, lead, metaDescription, metaTitle, methodLead, methodSteps, pageTitle, type InventoryStats } from './_inventoryCopy'

const ctx = { gameName: 'Murder Mystery 2', shortName: 'MM2' }
const s: InventoryStats = { priced: 827, total: 1067, listings: 12345, top: { name: 'Chroma Traveler’s Gun', usd: 4045.99 } }

describe('inventory copy', () => {
  it('titles carry the search phrase', () => {
    expect(pageTitle(ctx)).toBe('MM2 Inventory Value Calculator: What Is Your Inventory Worth?')
    expect(metaTitle(ctx)).toMatch(/^MM2 Inventory Value Calculator/)
    expect(metaTitle(ctx).length).toBeLessThanOrEqual(60)
  })

  it('states the live numbers, nothing invented', () => {
    const d = metaDescription(ctx, s)
    expect(d).toContain('827 MM2 items priced in USD from 12,345 live listings')
    expect(d.length).toBeLessThanOrEqual(240)
    const l = lead(ctx, s)
    expect(l.strong).toContain('US dollars')
    expect(l.rest).toContain('827 Murder Mystery 2 knives, guns and pets')
    expect(methodLead(ctx, s).rest).toContain('Chroma Traveler’s Gun at $4,045.99')
    expect(methodLead(ctx, { ...s, top: null }).rest).not.toContain('most valuable')
    expect(methodSteps(ctx, s)[0]!.value).toBe('Search 827 priced MM2 items by name')
  })

  it('FAQ answers the searches, drops questions the data cannot answer', () => {
    const qa = faq(ctx, s)
    expect(qa[0]!.q).toBe('How much is my MM2 inventory worth?')
    expect(qa.find((x) => x.q === 'What is the most valuable item in MM2?')!.a).toContain('$4,045.99')
    expect(qa.find((x) => x.q === 'Why is an item missing from the calculator?')!.a).toContain('240 MM2 items')
    const lean = faq(ctx, { ...s, top: null, total: 827 })
    expect(lean.some((x) => /most valuable/.test(x.q))).toBe(false)
    expect(lean.some((x) => /missing/.test(x.q))).toBe(false)
  })
})
