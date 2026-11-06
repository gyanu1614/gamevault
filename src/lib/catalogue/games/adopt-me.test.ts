import { describe, expect, it } from 'vitest'
import pages from './__fixtures__/am-pages.json'
import { adoptMe, amRarity, parseAmPage } from './adopt-me'
import type { WikiPage } from '../types'

const page = (title: string) => (pages as WikiPage[]).find((p) => p.title === title)!

describe('amRarity', () => {
  it('maps the infobox rarity to the CHECK values; TBA and unknown are null', () => {
    expect(amRarity('Legendary')).toBe('legendary')
    expect(amRarity('Ultra-Rare')).toBe('ultra_rare')
    expect(amRarity('Ultra Rare')).toBe('ultra_rare')
    expect(amRarity('[[Uncommon]]')).toBe('uncommon')
    expect(amRarity('TBA')).toBeNull()
  })
})

describe('parseAmPage', () => {
  it('a new event pet: rarity, egg origin, How To Get, picture, and limited availability', () => {
    const item = parseAmPage(page('Shoebill'), '2026-10-22')!
    expect(item).toMatchObject({
      slug: 'shoebill',
      name: 'Shoebill',
      rarity: 'uncommon',
      imageFile: 'Shoebill.png',
      releasedAt: '2026-10-16',
      pageUrl: 'https://adoptme.fandom.com/wiki/Shoebill',
      extra: { obtainability: 'limited' },
    })
    expect(item.howToGet).not.toBeNull()
  })

  it('a retired pet reads as unobtainable', () => {
    expect(parseAmPage(page('Frost Dragon'), '2026-10-22')).toMatchObject({ slug: 'frost-dragon', rarity: 'legendary', extra: { obtainability: 'unobtainable' } })
  })

  it('a pet page on the plain Item template still counts (Chestnut Glyptodon was skipped)', () => {
    const chestnut: WikiPage = {
      pageId: 1,
      revisionId: 1,
      title: 'Chestnut Glyptodon',
      categories: ['Category:Limited', 'Category:Pets', 'Category:Rare', 'Category:Unavailable'],
      content: "{{Ambiguous|[[Glyptodon]]}}\n{{Item\n|image = Chestnut Glyptodon.png\n|caption = The Chestnut Glyptodon in a player's inventory.\n|rarity = Rare\n|price = {{Acorns|20,000}}\n}}\nThe '''Chestnut Glyptodon''' is a limited rare [[Pets|pet]] in ''Adopt Me!'' that was released on July 18, 2026. It is now only obtainable through [[Trade System|trading]], as it left the game on July 24, 2026.",
    }
    expect(parseAmPage(chestnut, '2026-11-06')).toMatchObject({ slug: 'chestnut-glyptodon', name: 'Chestnut Glyptodon', rarity: 'rare', imageFile: 'Chestnut Glyptodon.png' })
  })

  it('an Item page with no rarity is not a pet', () => {
    const page: WikiPage = { pageId: 2, revisionId: 1, title: 'Some Item', categories: ['Category:Pets'], content: '{{Item\n|image = Some.png\n}}\nText.' }
    expect(parseAmPage(page, '2026-11-06')).toBeNull()
  })

  it('an upcoming pet, the Pets overview, an egg page and a subpage are not new pets', () => {
    expect(parseAmPage(page('Count Slothula (Pet)'), '2026-10-22')).toBeNull()
    expect(parseAmPage(page('Pets'), '2026-10-22')).toBeNull()
    expect(parseAmPage(page('Jungle Egg'), '2026-10-22')).toBeNull()
    expect(parseAmPage({ ...page('Shoebill'), title: 'Shoebill/Gallery' }, '2026-10-22')).toBeNull()
  })

  it('names a "(Pet)" page without the suffix once it is released', () => {
    const base = page('Count Slothula (Pet)')
    const released = { ...base, content: base.content.replace('|rarity = TBA', '|rarity = Legendary').replace('is an upcoming', 'is a') }
    expect(parseAmPage(released, '2026-10-24')).toMatchObject({ slug: 'count-slothula', name: 'Count Slothula', rarity: 'legendary' })
  })

  it('lists every pet page', () => {
    expect(adoptMe.listQueries).toEqual([{ list: 'categorymembers', title: 'Category:Pets' }])
  })
})
