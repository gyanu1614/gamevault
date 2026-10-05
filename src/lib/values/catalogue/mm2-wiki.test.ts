/**
 * MM2 wiki catalogue parsing. Fixtures are trimmed copies of real page
 * wikitext (murder-mystery-2.fandom.com, CC-BY-SA 3.0).
 */
import { describe, it, expect } from 'vitest'

import {
  applySourceCosts,
  buildMm2Catalogue,
  parseBoxPage,
  parseCosts,
  parseEventPassCost,
  parseImageFile,
  parseInfobox,
  parseItemType,
  parseObtain,
  parseRarity,
  parseRobuxPrice,
  stripWiki,
  typeFromTitle,
} from './mm2-wiki'

const HARVESTER = `{{Infobox Item
|theme=ancient
|title=Harvester
|image=HarvesterImproved.png
|rarity=[[ancient Weapons|<span style="color:#590fdd;">Ancient </span>]]
|obtain=[[Halloween Event 2021]] - Tier Reward (Formerly)
[[Trading]]
|type=[[:Category:Guns|<span style="color:white;">Gun </span>]]
|tier=2
|value=250 ([https://mm2values.com/v3/?p=home MM2V])
}}
'''Harvester''' is an ancient gun. [[Category:Halloween Event 2021]]`

const FANG = `{{Infobox_Item
|title=Fang
|image=<gallery>
FangUpdated.png|Current
FangOld.png|Original
</gallery>
|type=[[:Category:Knives|<span style="color:#FFFFFF">Knife</span>]]
|rarity=[[Godly Weapons|<span style="color:magenta;">Godly</span>]]
|obtain=[[Knife Box 2]]
[[Trading]]
|tier=2
|value=12 ([https://mm2values.com/v3/?p=home MM2V])
}}`

const CHROMA_FANG = `{{Infobox Item
|theme=chroma
|title=Chroma Fang
|image=Chromafang improved.png
|rarity=[[Godly Weapons|Godly]]
|obtain=[[Knife Box 2]]
[[Trading]]
|type=[[:Category:Knives|Knife]]
|tier=[[Chroma Weapons|<span style="background:-webkit-linear-gradient(180deg, red, blue);">Chroma</span>]]
|value=33 ([https://mm2values.com MM2V])
}}`

const KNIFE_BOX_2 = `[[File:S1KnifeBox2.png|thumb]]
'''Knife Box 2''' is a [[Boxes|weapon box]] that is currently '''purchasable''' from the [[shop]] using either 1,000 [[Coins]] {{Currency|Coin}}, 100 [[Diamonds]] {{Currency|Diamond}}, or 1 [[Mystery Key]] {{Currency|Mystery Key}}.

== Possible Rewards ==
{| class="wikitable"
! colspan="9" |Possible Rewards
|-
!Name
!Rarity
!Chance
|-
|[[Linked]]
|Common
|70%
|[[File:Linked improved.png|175px]]
|-
|style="color: #FA03B0"|[[Fang]]
|style="color: #FA03B0"|Godly
|style="color: #FA03B0"|0.2%
|[[File:FangUpdated.png|175px]]
|-
|[[Chroma Fang]]
|style="background:-webkit-linear-gradient(180deg, red, fuchsia);"|Godly
|style="background:-webkit-linear-gradient(180deg, red, fuchsia);"|0.004%
|[[File:Chromafang improved.png|175px]]
|}`

const HALLOWEEN_BOX_2023 = `The '''2023 Halloween Box''' was a [[Boxes|weapon box]] that was released during the [[Halloween Event 2023|2023 Halloween Event]]. It costed players 300  [[Candies (2023)|Candies]] or 1 [[Traveler Key]] to open it.
{| class="wikitable"
|-
| style="color: #FA03B0" |[[Traveler's Gun]]
| style="color: #FA03B0" |Gun
| style="color: #FA03B0" |Godly
| style="color: #FA03B0" |0.2%
|-<!-- rainbow text -->
| style="background:-webkit-linear-gradient(180deg, red, fuchsia);" |[[Chroma Traveler's Gun]]
| style="background:-webkit-linear-gradient(180deg, red, fuchsia);" |Gun
| style="background:-webkit-linear-gradient(180deg, red, fuchsia);" |Godly
| style="background:-webkit-linear-gradient(180deg, red, fuchsia);" |<0.2%*
|}`

describe('parseInfobox', () => {
  it('reads params across lines, keeping nested templates and links intact', () => {
    const box = parseInfobox(HARVESTER)!
    expect(box.title).toBe('Harvester')
    expect(box.obtain).toContain('[[Halloween Event 2021]] - Tier Reward (Formerly)')
    expect(box.type).toContain('Gun')
  })

  it('handles the {{Infobox_Item spelling and a <gallery> image', () => {
    const box = parseInfobox(FANG)!
    expect(box.title).toBe('Fang')
    expect(parseImageFile(box.image)).toBe('FangUpdated.png')
  })

  it('returns null for a page without an item infobox', () => {
    expect(parseInfobox("'''Weapons''' are items.")).toBeNull()
  })
})

describe('field parsers', () => {
  it('stripWiki turns links/spans/templates into text', () => {
    expect(stripWiki('[[Godly Weapons|<span style="color:magenta;">Godly</span>]] {{Currency|Coin}}')).toBe('Godly')
  })

  it('parseRarity: one canonical tier, null when ambiguous or N/A', () => {
    expect(parseRarity('[[ancient Weapons|<span>Ancient </span>]]')).toBe('Ancient')
    expect(parseRarity('Godly (Formerly Ancient)')).toBe('Godly')
    expect(parseRarity('Rare (Variant 1)\nGodly (Variant 3)')).toBeNull()
    expect(parseRarity('N/A')).toBeNull()
  })

  it('parseItemType from the infobox, falling back to categories; the title wins', () => {
    expect(parseItemType('[[:Category:Knives|Knife]]')).toBe('knife')
    expect(parseItemType('[[Pets|Pet]]')).toBe('pet')
    expect(parseItemType('', ['Guns'])).toBe('gun')
    expect(typeFromTitle('Pop Art (Knife)')).toBe('knife')
    expect(typeFromTitle('Bats Gun (2018)')).toBe('gun')
    expect(typeFromTitle('Harvester')).toBeNull()
  })

  it('parseCosts reads every price in a sentence', () => {
    expect(parseCosts('1,000 Coins, 100 Diamonds, or 1 Mystery Key')).toEqual([
      { amount: 1000, currency: 'Coins' },
      { amount: 100, currency: 'Diamonds' },
      { amount: 1, currency: 'Mystery Key' },
    ])
  })

  it('Robux prices for gamepasses and event battle passes', () => {
    expect(parseRobuxPrice("The '''Elite Gamepass''' is a gamepass that is purchasable for 499 Robux.")).toEqual({ amount: 499, currency: 'Robux' })
    expect(parseEventPassCost('The new battle pass costs 1,099 Robux and unlocks…')).toEqual({ amount: 1099, currency: 'Robux' })
    expect(parseEventPassCost('Collect candies to unlock tiers.')).toBeNull()
  })
})

describe('parseObtain', () => {
  it('drops Trading and classifies each real source', () => {
    const sources = parseObtain(
      [
        '[[Halloween Event 2021]] - Tier Reward (Formerly)',
        '[[Trading]]',
        '[[Knife Box 2]]',
        '[[2023 Halloween Box]] - Unbox (formerly)',
        'Buying the [[Batwing Gamepass]] (Offsale)',
        '[[Crafting]]',
        'Hatching [[Common Egg]]',
        'Christmas Event 2023 - Giving 100 Gifts',
        'Purchasing in the Shop for 75 Coins (Formerly)',
        'Redeeming a code',
        'Scrapped',
      ].join('\n'),
    )
    expect(sources.map((s) => [s.kind, s.name, s.still_obtainable])).toEqual([
      ['pass', 'Halloween Event 2021', false],
      ['box', 'Knife Box 2', true],
      ['box', '2023 Halloween Box', false],
      ['gamepass', 'Batwing Gamepass', false],
      ['crafting', 'Crafting', true],
      ['box', 'Common Egg', true],
      ['event', 'Christmas Event 2023', true],
      ['shop', 'Shop', false],
      ['code', 'Code', true],
      ['unobtainable', 'Scrapped', false],
    ])
    expect(sources[0]).toMatchObject({ year: 2021, method: 'Tier Reward' })
    expect(sources[2].year).toBe(2023)
    expect(sources[7].cost).toEqual({ amount: 75, currency: 'Coins' })
  })
})

describe('parseBoxPage', () => {
  it('reads costs, still-sold, and each reward row with its chance', () => {
    const box = parseBoxPage('Knife Box 2', KNIFE_BOX_2)
    expect(box.purchasable).toBe(true)
    expect(box.costs[0]).toEqual({ amount: 1000, currency: 'Coins' })
    expect(box.rewards.map((r) => [r.title, r.rarity, r.chancePct])).toEqual([
      ['Linked', 'Common', 70],
      ['Fang', 'Godly', 0.2],
      ['Chroma Fang', 'Godly', 0.004],
    ])
  })

  it('a past-tense box is not purchasable; "<0.2%" is a bound, not a number', () => {
    const box = parseBoxPage('2023 Halloween Box', HALLOWEEN_BOX_2023)
    expect(box.purchasable).toBe(false)
    expect(box.costs).toEqual([
      { amount: 300, currency: 'Candies' },
      { amount: 1, currency: 'Traveler Key' },
    ])
    const chroma = box.rewards.find((r) => r.title === "Chroma Traveler's Gun")!
    expect(chroma.chancePct).toBeNull()
    expect(chroma.chanceText).toBe('<0.2%')
  })
})

describe('buildMm2Catalogue', () => {
  const pages = [
    { title: 'Harvester', wikitext: HARVESTER },
    { title: 'Fang', wikitext: FANG },
    { title: 'Chroma Fang', wikitext: CHROMA_FANG },
    { title: 'Weapons', wikitext: 'List of weapons.' },
    { title: 'Pumpkin (Scrapped)', wikitext: FANG.replace('|title=Fang', '|title=Pumpkin') },
  ]
  const { items, skipped } = buildMm2Catalogue(pages, [parseBoxPage('Knife Box 2', KNIFE_BOX_2)])
  const bySlug = new Map(items.map((i) => [i.slug, i]))

  it('builds rows with type, rarity, year, origin and image', () => {
    expect(bySlug.get('harvester')).toMatchObject({
      name: 'Harvester',
      itemType: 'gun',
      rarity: 'Ancient',
      isChroma: false,
      releaseYear: 2021,
      origin: 'Halloween Event 2021',
      imageFile: 'HarvesterImproved.png',
    })
  })

  it('links a chroma row to its base and gives it the Chroma tier', () => {
    expect(bySlug.get('chroma-fang')).toMatchObject({ isChroma: true, baseSlug: 'fang', rarity: 'Chroma' })
  })

  it('enriches box sources with the box cost and this item\'s chance', () => {
    const [source] = bySlug.get('chroma-fang')!.obtain
    expect(source).toMatchObject({ kind: 'box', name: 'Knife Box 2', odds_pct: 0.004, still_obtainable: true, cost: { amount: 1000, currency: 'Coins' } })
    expect(source.alt_costs).toEqual([
      { amount: 100, currency: 'Diamonds' },
      { amount: 1, currency: 'Mystery Key' },
    ])
  })

  it('skips non-item and scrapped pages', () => {
    expect(skipped.map((s) => s.title).sort()).toEqual(['Pumpkin (Scrapped)', 'Weapons'])
  })

  it('NEVER carries the community value/tier fields', () => {
    const json = JSON.stringify(items)
    expect(json).not.toMatch(/mm2values|supreme|MM2V/i)
    for (const item of items) {
      expect(Object.keys(item)).not.toContain('value')
      expect(Object.keys(item)).not.toContain('tier')
    }
  })

  it('applySourceCosts fills gamepass / pass costs from their pages', () => {
    const { items: gp } = buildMm2Catalogue([
      { title: 'Batwing', wikitext: HARVESTER.replace('[[Halloween Event 2021]] - Tier Reward (Formerly)', 'Buying the [[Batwing Gamepass]] (Offsale)') },
    ])
    applySourceCosts(gp, new Map([['batwing gamepass', { amount: 2499, currency: 'Robux' }]]))
    expect(gp[0].obtain[0]).toMatchObject({ kind: 'gamepass', cost: { amount: 2499, currency: 'Robux' }, still_obtainable: false })
  })
})
