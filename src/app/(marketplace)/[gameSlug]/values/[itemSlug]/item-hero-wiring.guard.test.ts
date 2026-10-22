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

// Owner, 2026-10-21: "whenever we get new items ... we add a badge which shows new".
describe('New tag on every values hub', () => {
  it('each item page computes isNewItem and its hero hands it to ValueItemHero', () => {
    const pages: Array<[page: string, hero: string]> = [
      ['[itemSlug]/_SabItemPage.tsx', '[itemSlug]/_ItemHero.tsx'],
      ['[itemSlug]/_AdoptMePetPage.tsx', '[itemSlug]/_AdoptMePetHero.tsx'],
      ['_generic/ValueListItemBody.tsx', '_generic/ValueListItemClient.tsx'],
    ]
    for (const [page, hero] of pages) {
      expect(read(page), page).toMatch(/isNew=\{isNewItem\(/)
      expect(read(hero), hero).toMatch(/isNew=\{isNew\}/)
    }
    // Steal an Egg renders ValueItemHero itself.
    expect(read('_generic/ValueItemPage.tsx')).toMatch(/isNew=\{isNewItem\(/)
  })

  it('each list loader computes the flag and each list card shows the tag', () => {
    for (const loader of ['_sabBrainrots.ts', '_adoptMeData.ts', '_generic/valueListRows.ts']) {
      expect(read(loader), loader).toMatch(/isNewItem\(/)
    }
    for (const card of ['_ValuesDirectoryClient.tsx', '_AdoptMeValuesClient.tsx', '_generic/ValueListClient.tsx', '_generic/ValuesHubPage.tsx']) {
      expect(read(card), card).toMatch(/<NewTag \/>/)
    }
  })
})
