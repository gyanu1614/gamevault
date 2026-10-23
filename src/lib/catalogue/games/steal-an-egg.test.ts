import { describe, expect, it } from 'vitest'
import pages from './__fixtures__/sae-pages.json'
import { parseSaePage, stealAnEgg } from './steal-an-egg'
import type { WikiPage } from '../types'

const page = (title: string) => (pages as WikiPage[]).find((p) => p.title === title)!

describe('parseSaePage', () => {
  it('reads a pet from {{Detail}}: the page title as its name, rarity, income, area and egg', () => {
    expect(parseSaePage(page('Voidseer Pumpkin'))).toMatchObject({
      slug: 'voidseer-pumpkin',
      name: 'Voidseer Pumpkin',
      rarity: 'Divine',
      imageFile: null,
      howToGet: null,
      origin: 'Abandoned manor (Haloween dimension)',
      extra: { area: 'Abandoned manor (Haloween dimension)', income: 12_500_000_000, eggName: 'VOIDSEER' },
    })
  })

  it('an empty {{Detail}}, a page without one, and a subpage are not pets', () => {
    expect(parseSaePage(page('Werewolf'))).toBeNull()
    expect(parseSaePage({ ...page('Voidseer Pumpkin'), content: 'Just text.' })).toBeNull()
    expect(parseSaePage({ ...page('Voidseer Pumpkin'), title: 'Voidseer Pumpkin/Gallery' })).toBeNull()
  })

  it('drops a biome that is really an egg name, and takes a real image file', () => {
    const base = page('Voidseer Pumpkin')
    const content = base.content.replace('biome=Abandoned manor (Haloween dimension)', 'biome=Luminous Egg').replace('pet_image=VOIDSEER', 'pet_image=Voidseer Pumpkin.png')
    expect(parseSaePage({ ...base, content })).toMatchObject({ origin: null, imageFile: 'Voidseer Pumpkin.png', extra: { area: null } })
  })

  it('lists every pet page', () => {
    expect(stealAnEgg.listQueries).toEqual([{ list: 'categorymembers', title: 'Category:Pets' }])
  })
})
