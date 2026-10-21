import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/app/(marketplace)/[gameSlug]/values'
const read = (f: string) => readFileSync(join(process.cwd(), dir, f), 'utf8')

// Owner, 2026-10-14 (item page redesign).
describe('value item heroes', () => {
  it('SAB opens with the "<Name> Value in Steal a Brainrot" H1 like Adopt Me and MM2', () => {
    expect(read('[itemSlug]/_SabItemPage.tsx')).toMatch(/<ItemPageTitle name=\{brainrot\.name\} game="Steal a Brainrot" \/>/)
    expect(read('[itemSlug]/_itemMetadata.ts')).toMatch(/const title = `\$\{brainrot\.name\} Value in Steal a Brainrot/)
    expect(read('[itemSlug]/_ItemHero.tsx')).toMatch(/titleAs="h2"/)
  })

  it('SAB drops Availability (Adopt Me keeps it)', () => {
    expect(read('[itemSlug]/_ItemHero.tsx')).not.toMatch(/label: 'Availability'/)
    expect(read('[itemSlug]/_AdoptMePetHero.tsx')).toMatch(/label: 'Availability'/)
  })

  it('every hero uses the one buy panel — our price first, never the cheapest called "Market Price"', () => {
    for (const f of ['[itemSlug]/_ItemHero.tsx', '[itemSlug]/_AdoptMePetHero.tsx', '_generic/ValueListItemClient.tsx']) {
      const src = read(f)
      expect(src, f).toMatch(/<ValueBuyPanel\b/)
      expect(src, f).not.toMatch(/headlineUsd = selected\.cheapestUsd/)
    }
  })
})
