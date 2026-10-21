import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 2026-10-20 outage: item loaders turned a DB error into null → notFound(),
// and ISR cached the 404 for 7 days on the Adopt Me and MM2 item pages.
// A read error must throw; only "no such row" may be null.
const read = (p: string) => readFileSync(p, 'utf8')

describe('value page loaders never turn a read error into a 404', () => {
  it('Adopt Me pet loader throws on error', () => {
    const src = read('src/app/(marketplace)/[gameSlug]/values/[itemSlug]/_adoptMePetData.ts')
    expect(src).not.toMatch(/if \(error \|\| !pet\) return null/)
    expect(src).toMatch(/if \(error\) throw new Error\(`adopt_me_pets read failed/)
  })
  it('Steal a Brainrot loader throws on error', () => {
    const src = read('src/app/(marketplace)/[gameSlug]/values/[itemSlug]/_sabItemData.ts')
    expect(src).not.toMatch(/Unable to load Brainrot value page[\s\S]{0,40}return null/)
    expect(src).toMatch(/if \(error\) throw new Error\(`sab_brainrot_market_catalog read failed/)
  })
})
