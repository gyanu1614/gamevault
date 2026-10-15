import { describe, it, expect } from 'vitest'
import { newOnlyPlan, catalogueGapSummary } from '../../../scripts/lib/catalogue-new-only.mjs'

// Weekly catalogue jobs (owner, 2026-10-14: "for adopt me, mm2 and all games
// which might need weekly checks, we do that, via the job"). A scheduled run
// may only ADD what the wiki has and we do not: it must never rewrite an
// existing row (an admin-disabled item would come back on, the order reset).
describe('newOnlyPlan', () => {
  const items = [{ slug: 'seer' }, { slug: 'luger' }, { slug: 'chroma-luger' }]

  it('keeps only slugs we do not have, numbered after the current last row', () => {
    const plan = newOnlyPlan(items, [{ slug: 'seer', sort_order: 4 }, { slug: 'old', sort_order: 9 }])
    expect(plan.fresh.map((i: { slug: string }) => i.slug)).toEqual(['luger', 'chroma-luger'])
    expect(plan.startOrder).toBe(10)
  })

  it('starts at 0 on an empty game and adds nothing when nothing is new', () => {
    expect(newOnlyPlan(items, []).startOrder).toBe(0)
    expect(newOnlyPlan(items, items.map((i, n) => ({ slug: i.slug, sort_order: n }))).fresh).toEqual([])
  })
})

describe('catalogueGapSummary', () => {
  it('lists what was added (or missing) for the job summary, capped', () => {
    const names = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}`)
    const md = catalogueGapSummary('New MM2 items added', names, 30)
    expect(md).toContain('### New MM2 items added (40)')
    expect(md).toContain('- Item 30')
    expect(md).not.toContain('- Item 31')
    expect(md).toContain('…and 10 more')
    expect(catalogueGapSummary('New MM2 items added', [])).toBe('### New MM2 items added (0)\nNone found.\n')
  })
})
