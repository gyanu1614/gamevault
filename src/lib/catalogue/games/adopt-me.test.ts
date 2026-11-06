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

  it('a toy on the Item template is not a pet (Netzooka got in this way)', () => {
    const toy: WikiPage = {
      pageId: 206641,
      revisionId: 1,
      title: 'Netzooka',
      categories: ['Category:Toys', 'Category:Legendary', 'Category:Legendary Toys', 'Category:Limited', 'Category:Unavailable'],
      content: "{{Item\n|image = Netzooka.png\n|caption = The Netzooka in a player's inventory.\n|rarity = Legendary\n}}\nThe '''Netzooka''' is a limited legendary [[Toys|toy]] in ''Adopt Me!''.",
    }
    expect(parseAmPage(toy, '2026-11-06')).toBeNull()
  })

  it('a potion on the Item template, whose category names a rarity of pets only in part, is not a pet', () => {
    const potion: WikiPage = { pageId: 3, revisionId: 1, title: 'Grow Potion', categories: ['Category:Potions', 'Category:Food', 'Category:Rare', 'Category:Rare Pets Food'], content: '{{Item\n|image = Grow.png\n|rarity = Rare\n}}\nA potion.' }
    expect(parseAmPage(potion, '2026-11-06')).toBeNull()
  })

  it('a food page built on the pet template is not a pet (the wiki has Birthday Cake)', () => {
    const food: WikiPage = { pageId: 4, revisionId: 1, title: 'Birthday Cake', categories: ['Category:Food', 'Category:Common'], content: "{{Pets\n|image = Cake.png\n|rarity = Common\n}}\nThe '''Birthday Cake''' is a common [[food]]." }
    expect(parseAmPage(food, '2026-11-06')).toBeNull()
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
