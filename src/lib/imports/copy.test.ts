import { describe, it, expect } from 'vitest'
import {
  buildTitle, renderTitle, stableIndex, TITLE_PATTERNS, TITLE_SEO_MAX, SNIPPET_MAX,
  buildDescription, factLines, formatIncome, deliverySteps, deliveryBlock, DELIVERY_WORDINGS,
  openingLine, OPENING_COUNT, article,
  searchPhrases, variantTitleToken, variantLeadPhrase, TRUST_LINE,
  type TitleParts,
} from './copy'
import { TITLE_MIN, DESCRIPTION_MAX } from '@/lib/listings/validate'
import { HUB_COPY } from '@/lib/content/theme'
import type { CatalogueItem } from './types'

const FROST: CatalogueItem = {
  ref: 'frost-dragon',
  name: 'Frost Dragon',
  aliases: [],
  facts: { rarity: 'legendary', obtainedFrom: 'Christmas Event 2019' },
  imageUrl: null,
}

const FR = { ref: 'FR', label: 'Fly Ride' }

const PARTS: TitleParts = {
  itemName: 'Frost Dragon',
  variantToken: 'FR',
  variantLabel: 'Fly Ride',
  gameName: 'Adopt Me',
  itemNoun: 'pet',
}

describe('titles read like a seller wrote them', () => {
  it('renders the approved shape: variant, item, then the game', () => {
    expect(TITLE_PATTERNS.map((p) => renderTitle(p(PARTS)))).toEqual(['FR Frost Dragon | Adopt Me'])
  })

  it('every item gets that same shape', () => {
    for (const ref of ['frost-dragon', 'shadow-dragon', 'owl', 'crow', 'giraffe']) {
      expect(buildTitle({ ...PARTS, itemName: 'X Pet' }, ref)).toBe('FR X Pet | Adopt Me')
    }
  })

  it('drops the variant cleanly for an item with none', () => {
    expect(buildTitle({ ...PARTS, variantToken: null, variantLabel: null, itemName: 'Owl' }, 'owl'))
      .toBe('Owl | Adopt Me')
  })

  it('carries NO marketing furniture and never the brand name', () => {
    for (const p of TITLE_PATTERNS) {
      const t = renderTitle(p(PARTS))
      for (const banned of [/dropmarket/i, /\bbuy now\b/i, /\bcheap\b/i, /\bbest\b/i, /!{1,}/, /\bsale\b/i]) {
        expect(t, `${t} matched ${banned}`).not.toMatch(banned)
      }
    }
  })

  it('carries the item, the variant and the game — what a real query contains', () => {
    for (const p of TITLE_PATTERNS) {
      const t = renderTitle(p(PARTS))
      expect(t).toContain('Frost Dragon')
      expect(t).toContain('Adopt Me')
      expect(t).toContain('FR')
    }
  })

  it('fits the 48-char budget the page title clips at', () => {
    for (const p of TITLE_PATTERNS) {
      expect(renderTitle(p(PARTS)).length).toBeLessThanOrEqual(TITLE_SEO_MAX)
    }
  })

  it('is long enough for the validator', () => {
    for (const p of TITLE_PATTERNS) {
      expect(renderTitle(p(PARTS)).length).toBeGreaterThanOrEqual(TITLE_MIN)
    }
  })
})

describe('title rotation is stable', () => {
  it('gives the same item the same shape every time — a re-import must not change a URL', () => {
    const first = buildTitle(PARTS, 'frost-dragon')
    for (let i = 0; i < 25; i += 1) expect(buildTitle(PARTS, 'frost-dragon')).toBe(first)
  })

  it('still spreads across shapes if a game ever registers more than one', () => {
    const refs = ['frost-dragon', 'shadow-dragon', 'bat-dragon', 'owl', 'crow', 'giraffe', 'kangaroo', 'parrot', 'unicorn', 'turtle']
    const used = new Set(refs.map((r) => stableIndex(r, 3)))
    expect(used.size).toBe(3)
  })

  it('stableIndex stays in range and tolerates an empty key', () => {
    for (const key of ['', 'a', 'a-very-long-item-reference-slug']) {
      const i = stableIndex(key, 3)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(3)
    }
    expect(stableIndex('x', 0)).toBe(0)
  })
})

describe('titles that do not fit drop the game, never mangle the item', () => {
  const LONG: TitleParts = {
    itemName: 'La Vacca Saturno Saturnita Supreme',
    variantToken: 'Rainbow',
    variantLabel: 'Rainbow',
    gameName: 'Steal a Brainrot',
    itemNoun: 'brainrot',
  }

  it('keeps the whole item name and sheds the tail', () => {
    const t = renderTitle(TITLE_PATTERNS[0](LONG))
    expect(t.length).toBeLessThanOrEqual(TITLE_SEO_MAX)
    expect(t).toContain('La Vacca Saturno Saturnita Supreme')
    expect(t).not.toContain('Steal a Brainrot')
  })

  it('clips on a word boundary only when the core itself is too long', () => {
    const t = renderTitle({ core: 'Wordy '.repeat(20).trim(), tail: 'Adopt Me' })
    expect(t.length).toBeLessThanOrEqual(TITLE_SEO_MAX)
    expect(t).not.toMatch(/\s$/)
    expect(t.split(' ').every((w) => w === 'Wordy')).toBe(true)
  })
})

describe('variant wording', () => {
  it("uses the code in a title and spells it out once in the snippet (Adopt Me)", () => {
    expect(variantTitleToken(FR, 'code')).toBe('FR')
    expect(variantLeadPhrase(FR, 'code')).toBe('Fly Ride (FR)')
  })

  it('uses the name for a game whose ref is a slug (Steal a Brainrot)', () => {
    const gold = { ref: 'gold', label: 'Gold' }
    expect(variantTitleToken(gold, 'label')).toBe('Gold')
    expect(variantLeadPhrase(gold, 'label')).toBe('Gold')
  })

  it('does not repeat itself when the code and the label are the same word', () => {
    expect(variantLeadPhrase({ ref: 'Neon', label: 'Neon' }, 'code')).toBe('Neon')
  })

  it('is null when there is no variant', () => {
    expect(variantTitleToken(null, 'code')).toBeNull()
    expect(variantLeadPhrase(null, 'code')).toBeNull()
  })
})

describe('articles', () => {
  it.each([
    ['FR Frost Dragon', 'an'],
    ['NFR Bat Dragon', 'an'],
    ['MFR Giraffe', 'an'],
    ['Frost Dragon', 'a'],
    ['Owl', 'an'],
    ['Unicorn', 'a'],
    ['Ultra Rare Pet', 'an'],
    ['Fly Ride (FR) Frost Dragon', 'a'],
    ['Neon Fly Ride (NFR) Owl', 'a'],
  ])('%s takes "%s"', (phrase, want) => {
    expect(article(phrase)).toBe(want)
  })
})

describe('openings — the first line a buyer reads', () => {
  const ctx = { full: 'Fly Ride (FR) Frost Dragon', short: 'FR Frost Dragon', game: 'Adopt Me' }

  it('there are eight to rotate through', () => {
    expect(OPENING_COUNT).toBe(8)
  })

  it('is the same every time for the same pet and variant — a re-import never rewrites it', () => {
    const first = openingLine(ctx, 'frost-dragon|FR')
    for (let i = 0; i < 20; i += 1) expect(openingLine(ctx, 'frost-dragon|FR')).toBe(first)
  })

  it('reads differently across a real catalogue', () => {
    const keys = ['frost-dragon|FR', 'frost-dragon|NFR', 'frost-dragon|MFR', 'bat-dragon|FR', 'bat-dragon|NFR',
      'giraffe|FR', 'kangaroo|FR', 'panda|FR', 'owl|FR', 'crow|NFR', 'parrot|MFR', 'unicorn|FR']
    const lines = new Set(keys.map((k) => openingLine(ctx, k)))
    expect(lines.size).toBeGreaterThanOrEqual(5)
  })

  it('never opens with "Buy" — the page meta already does', () => {
    for (let i = 0; i < 60; i += 1) {
      expect(openingLine(ctx, `pet-${i}|FR`)).not.toMatch(/^Buy\b/)
    }
  })

  it('names the pet, the variant and the game every time', () => {
    for (let i = 0; i < 60; i += 1) {
      const line = openingLine(ctx, `pet-${i}|FR`)
      expect(line).toContain('Frost Dragon')
      expect(line).toContain('Adopt Me')
      expect(line).toContain('FR')
    }
  })

  it('gets "an" right before a letter code', () => {
    for (let i = 0; i < 60; i += 1) {
      const line = openingLine(ctx, `pet-${i}|FR`)
      expect(line).not.toMatch(/\ba FR\b/)
    }
  })

  it('reads cleanly with no variant (no doubled names)', () => {
    const plain = { full: 'Jungle Egg', short: 'Jungle Egg', game: 'Steal An Egg' }
    for (let i = 0; i < 60; i += 1) {
      const line = openingLine(plain, `egg-${i}|`)
      expect(line.match(/Jungle Egg/g)?.length).toBe(1)
    }
  })

  it('stays inside the snippet length', () => {
    const long = { full: 'Mega Fly Ride (MFR) Strawberry Shortcake Bat Dragon', short: 'MFR Strawberry Shortcake Bat Dragon', game: 'Adopt Me' }
    for (let i = 0; i < 60; i += 1) expect(openingLine(long, `p-${i}|MFR`).length).toBeLessThanOrEqual(SNIPPET_MAX)
  })
})

describe('delivery instructions', () => {
  it('walks the buyer through a manual in-game trade', () => {
    expect(deliverySteps({ method: 'manual', window: '1hr' }, 'Adopt Me', 'pet')).toEqual([
      'Check out. A chat with the seller opens on your order.',
      'The seller messages you to pick a time in Adopt Me.',
      'Join them in-game and accept the trade.',
      'Once the pet is in your inventory, hit Confirm Delivery.',
    ])
  })

  it('has three wordings, each stating the window and ending on Confirm Delivery', () => {
    expect(DELIVERY_WORDINGS).toBe(3)
    const seen = new Set<string>()
    for (let i = 0; i < 40; i += 1) {
      const d = deliveryBlock({ method: 'manual', window: '1hr' }, { game: 'Adopt Me', noun: 'pet', itemName: 'Frost Dragon' }, `pet-${i}|FR`)
      seen.add(d.heading)
      expect(d.lead).toContain('1 hour')
      expect(d.steps.at(-1)).toMatch(/Confirm Delivery/)
      expect(d.heading.endsWith('?')).toBe(true)
    }
    expect(seen.size).toBe(3)
  })

  it('has a shorter path for instant delivery', () => {
    const d = deliveryBlock({ method: 'instant', window: '15min' }, { game: 'Adopt Me', noun: 'pet', itemName: 'Owl' }, 'owl|')
    expect(d.steps).toHaveLength(3)
    expect(d.lead).toContain('instant')
  })

  it('says nothing about when the seller is paid', () => {
    const text: string[] = []
    for (let i = 0; i < 40; i += 1) {
      const d = deliveryBlock({ method: 'manual', window: '1hr' }, { game: 'Adopt Me', noun: 'pet', itemName: 'Owl' }, `k-${i}`)
      text.push(d.heading, d.lead, ...d.steps)
    }
    text.push(...deliverySteps({ method: 'instant', window: '1hr' }, 'Adopt Me', 'pet'))
    const all = text.join(' ')
    for (const re of [/\bescrow\b/i, /funds are held/i, /we hold/i, /paid on delivery/i, /paid only after/i, /paid out/i, /\bpayout\b/i]) {
      expect(all, String(re)).not.toMatch(re)
    }
  })
})

describe('trust line', () => {
  it('is the site copy slot verbatim, so listing copy cannot drift from the hubs', () => {
    expect(TRUST_LINE).toBe(HUB_COPY.safedrop)
  })
})

describe('search phrases', () => {
  it('produces the phrases people type, lower-cased', () => {
    expect(searchPhrases({ itemName: 'Frost Dragon', variantToken: 'FR', variantLabel: 'Fly Ride', gameName: 'Adopt Me' }))
      .toEqual(['fr frost dragon', 'frost dragon adopt me', 'buy fr frost dragon', 'fly ride frost dragon', 'frost dragon price'])
  })

  it('has a no-variant set for a game without one', () => {
    expect(searchPhrases({ itemName: 'Jungle Egg', variantToken: null, variantLabel: null, gameName: 'Steal An Egg' }))
      .toEqual(['jungle egg steal an egg', 'buy jungle egg', 'jungle egg for sale', 'cheap jungle egg', 'jungle egg price'])
  })

  it('de-duplicates when the code and the label are the same word', () => {
    const p = searchPhrases({ itemName: 'Tralalero', variantToken: 'Gold', variantLabel: 'Gold', gameName: 'Steal a Brainrot' })
    expect(new Set(p).size).toBe(p.length)
  })

  it('differs per item, so 500 listings are not one template', () => {
    const a = searchPhrases({ itemName: 'Frost Dragon', variantToken: 'FR', variantLabel: 'Fly Ride', gameName: 'Adopt Me' })
    const b = searchPhrases({ itemName: 'Shadow Dragon', variantToken: 'FR', variantLabel: 'Fly Ride', gameName: 'Adopt Me' })
    expect(a).not.toEqual(b)
  })
})

describe('facts — only what the catalogue holds', () => {
  it('emits a line per present fact, prettified', () => {
    expect(factLines({ rarity: 'ultra_rare', area: 'jungle', obtainedFrom: 'Jungle Egg' }))
      .toEqual(['Rarity: Ultra Rare', 'Area: Jungle', 'Obtained from: Jungle Egg'])
  })

  it('emits NOTHING for missing, null or blank facts', () => {
    expect(factLines({})).toEqual([])
    expect(factLines({ rarity: null, area: '   ', obtainedFrom: undefined })).toEqual([])
  })

  it('includes income only when positive', () => {
    expect(factLines({ incomePerSec: 1500 })).toEqual(['Income: 1.5K/sec'])
    expect(factLines({ incomePerSec: 0 })).toEqual([])
  })
})

describe('formatIncome', () => {
  it.each([[999, '999'], [1500, '1.5K'], [250_000, '250K'], [2_400_000, '2.4M'], [7e9, '7B']])(
    '%i → %s', (n, want) => expect(formatIncome(n)).toBe(want),
  )
})

describe('the assembled description', () => {
  const FR_NOTE = { ...FR, note: 'Fly Ride (FR): this pet can fly and you can ride it.' }
  const build = (over: Partial<Parameters<typeof buildDescription>[0]> = {}) =>
    buildDescription({
      item: FROST,
      variant: FR_NOTE,
      variantStyle: 'code',
      gameName: 'Adopt Me',
      itemNoun: 'pet',
      delivery: { method: 'manual', window: '1hr' },
      ...over,
    })
  const d = build()

  it('has the blocks in order: opening, variant + facts, delivery, trust, searches', () => {
    const blocks = d.split('\n\n')
    expect(blocks).toHaveLength(5)
    expect(blocks[0]).toContain('Frost Dragon')
    expect(blocks[1]).toBe('Fly Ride (FR): this pet can fly and you can ride it.\nRarity: Legendary\nObtained from: Christmas Event 2019')
    expect(blocks[2]).toMatch(/\?\n/) // a question heading, answered on the next line
    expect(blocks[2]).toMatch(/Confirm Delivery/)
    expect(blocks[3]).toBe(TRUST_LINE)
    expect(blocks[4]).toMatch(/^(Also searched as|People also search|Related searches): fr frost dragon, /)
  })

  it('is identical on a re-import of the same row', () => {
    expect(build()).toBe(d)
  })

  it('reads differently for the FR and NFR listings of one pet', () => {
    const nfr = build({ variant: { ref: 'NFR', label: 'Neon Fly Ride', note: 'Neon Fly Ride (NFR): a glowing Neon that can fly and be ridden.' } })
    expect(nfr).not.toBe(d)
    expect(nfr).toContain('Neon Fly Ride (NFR): a glowing Neon')
  })

  it('produces many distinct texts across a catalogue, not one stamped template', () => {
    const texts = new Set<string>()
    for (const name of ['Frost Dragon', 'Bat Dragon', 'Giraffe', 'Kangaroo', 'Panda', 'Owl', 'Crow', 'Parrot']) {
      for (const v of [FR, { ref: 'NFR', label: 'Neon Fly Ride' }, { ref: 'MFR', label: 'Mega Fly Ride' }]) {
        const ref = name.toLowerCase().replace(/ /g, '-')
        // compare the WORDING only — swap the names out so facts cannot make texts differ
        texts.add(build({ item: { ...FROST, ref, name }, variant: v }).split(name).join('X').split(v.ref).join('V').split(v.label).join('L'))
      }
    }
    expect(texts.size).toBeGreaterThanOrEqual(8)
  })

  it('never mentions the brand name in stored seller copy', () => {
    expect(d).not.toMatch(/dropmarket/i)
  })

  it('follows the copy rules: no AI words, no hype, very few em dashes', () => {
    for (let i = 0; i < 40; i += 1) {
      const t = build({ item: { ...FROST, ref: `p-${i}` } })
      for (const re of [/\bdelve\b/i, /\belevate\b/i, /\bseamless/i, /\bunlock/i, /\bembark/i, /look no further/i, /game-changer/i, /\bcheapest\b/i, /\bbest price\b/i]) {
        expect(t, String(re)).not.toMatch(re)
      }
      // only the trust line (site copy) carries one
      expect((t.match(/—/g) ?? []).length).toBeLessThanOrEqual(1)
    }
  })

  it('fits the column', () => {
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('skips the fact block when there is nothing to say', () => {
    const bare = build({ item: { ...FROST, facts: {} }, variant: null, gameName: 'Steal An Egg', itemNoun: 'egg' })
    expect(bare).not.toMatch(/Rarity:/)
    expect(bare).not.toMatch(/unknown|undefined|null/i)
    expect(bare.split('\n\n')).toHaveLength(4)
  })

  it('includes game-specific notes', () => {
    const withNote = build({
      item: { ...FROST, facts: {} },
      variant: null,
      variantStyle: 'label',
      gameName: 'Steal An Egg',
      itemNoun: 'egg',
      notes: ['Sold sealed. The pet inside is random.'],
    })
    expect(withNote).toContain('Sold sealed. The pet inside is random.')
  })
})
