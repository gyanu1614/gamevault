import { describe, expect, it } from 'vitest'
import type { ValueHowToGet } from './how-to-get'
import { howToGetWays } from './how-to-get-copy'
import { factFaqs, factRows, mergeFaqs, NO_FACTS, releasedLabel } from './item-facts'
import { itemFactsGame } from './item-facts-config'

const am = itemFactsGame('adopt-me')
const sab = itemFactsGame('steal-a-brainrot')

const howTo = (h: Partial<ValueHowToGet> & Pick<ValueHowToGet, 'status' | 'method'>): ValueHowToGet => ({
  costs: null,
  odds: null,
  released: null,
  note: null,
  sources: ['https://adoptme.fandom.com/wiki/Fossil_Egg'],
  confidence: 'high',
  checkedAt: '2026-10-19',
  ...h,
})

describe('itemFactsGame', () => {
  it('MM2 keeps its short name, earn rate and Shop words; AM and SAB use their full names', () => {
    const mm2 = itemFactsGame('murder-mystery-2')
    expect([mm2.gameName, mm2.shortName, mm2.earnRate?.unit, mm2.vocab.shop]).toEqual(['Murder Mystery 2', 'MM2', 'Coins', 'the in-game Shop'])
    expect([am.gameName, am.shortName, am.vocab.shop, am.vocab.craft]).toEqual(['Adopt Me', 'Adopt Me', 'the Nursery', null])
    expect([sab.gameName, sab.shortName, sab.earnRate]).toEqual(['Steal a Brainrot', 'Steal a Brainrot', null])
  })
  it('a game without its own words gets copy that names no place or currency it may not have', () => {
    const v = itemFactsGame('some-new-game').vocab
    expect(v.gone).toBe('It can’t be obtained in-game anymore')
    expect([v.earn, v.craft]).toEqual([null, null])
  })
})

describe('releasedLabel', () => {
  it('a day reads as a date, a year as a year, junk as nothing', () => {
    expect(releasedLabel({ date: '2022-10-27' })).toBe('27 October 2022')
    expect(releasedLabel({ year: 2021 })).toBe('2021')
    expect(releasedLabel({ date: '2022-02-31' })).toBeNull()
    expect(releasedLabel({ year: 1999 })).toBeNull()
    expect(releasedLabel({})).toBeNull()
  })
})

describe('factRows', () => {
  it('only what is known, Released before Origin', () => {
    expect(factRows({ released: '2022', origin: 'Fossil Egg', howToGet: null })).toEqual([
      { label: 'Released', value: '2022' },
      { label: 'Origin', value: 'Fossil Egg' },
    ])
    expect(factRows(NO_FACTS)).toEqual([])
  })
})

describe('factFaqs', () => {
  it('a verified How To Get entry answers with the shared MM2 wording, in the game’s own words', () => {
    const facts = {
      released: null,
      origin: null,
      howToGet: howTo({ status: 'unobtainable', method: 'Hatched from the Fossil Egg in the Nursery (2020).' }),
    }
    const qs = factFaqs({ name: 'T-Rex', game: am, facts, cheapestUsd: 12 })
    expect(qs.map((f) => f.q)).toEqual(['How do you get T-Rex in Adopt Me?', 'Can you get T-Rex for free in Adopt Me?'])
    expect(qs[1].a).toContain('It isn’t sold in the Nursery or for Robux anymore, so buying it from another player from $12.00')
    expect(qs[1].a).not.toMatch(/Shop/)
  })
  it('without one, the release date and origin answer "when did it come out"', () => {
    const [f] = factFaqs({ name: 'Ghost Wolf', game: am, facts: { released: '20 October 2022', origin: 'Halloween Event (2022)', howToGet: null }, cheapestUsd: null })
    expect(f.q).toBe('When was Ghost Wolf released in Adopt Me?')
    expect(f.a).toMatch(/^Ghost Wolf was released on 20 October 2022, from the Halloween Event \(2022\)\. Besides that/)
    const [y] = factFaqs({ name: 'Garama', game: sab, facts: { released: '2025', origin: null, howToGet: null }, cheapestUsd: null })
    expect(y.a).toMatch(/^Garama was released in 2025\./)
    const [o] = factFaqs({ name: 'Garama', game: sab, facts: { released: null, origin: 'Admin Abuse', howToGet: null }, cheapestUsd: null })
    expect(o.q).toBe('Where does Garama come from in Steal a Brainrot?')
    expect(factFaqs({ name: 'X', game: sab, facts: NO_FACTS, cheapestUsd: null })).toEqual([])
  })
})

describe('mergeFaqs', () => {
  it('facts go in after the worth answer and replace a base entry asking the same thing', () => {
    const base = [
      { q: 'How much is X worth?', a: 'worth' },
      { q: 'How do you get X in Steal a Brainrot?', a: 'old' },
      { q: 'Is X good?', a: 'good' },
    ]
    const merged = mergeFaqs(base, [{ q: 'How do you get X in Steal a Brainrot?', a: 'verified' }])
    expect(merged.map((f) => f.a)).toEqual(['worth', 'verified', 'good'])
    expect(mergeFaqs(base, [])).toBe(base)
  })
  it('the verified answer keeps the replaced entry’s place, even when that was first', () => {
    const base = [{ q: 'How do you get X?', a: 'old' }, { q: 'Where to buy X?', a: 'buy' }]
    expect(mergeFaqs(base, [{ q: 'How do you get X?', a: 'new' }, { q: 'Free?', a: 'free' }]).map((f) => f.a)).toEqual(['new', 'free', 'buy'])
    expect(mergeFaqs([], [{ q: 'Q', a: 'a' }]).map((f) => f.a)).toEqual(['a'])
  })
})

describe('How To Get copy in another game’s words', () => {
  it('an Adopt Me egg: hatch maths, Bucks earned by playing, the Nursery', () => {
    const w = howToGetWays({
      name: 'Frost Dragon',
      gameName: am.gameName,
      shortName: am.shortName,
      h: howTo({ status: 'obtainable', method: 'Hatched from the Fossil Egg in the Nursery.', costs: '750 Bucks per hatch', odds: '1.5% per hatch' }),
      cheapestUsd: 30,
      earnRate: am.earnRate,
      vocab: am.vocab,
    })
    expect(w.lead).toBe('Yes, you can get Frost Dragon for free in Adopt Me from Fossil Egg.')
    expect(w.free.steps.map((s) => [s.title, s.value])).toEqual([
      ['Earn Bucks', 'Earned by caring for pets and from paychecks'],
      ['Open Fossil Egg', 'In the Nursery'],
      ['Hatch It', '750 Bucks per hatch'],
      ['Land The Drop', '1.5% per hatch — about 67 hatches'],
    ])
    expect(w.free.total?.value).toBe('50,250 Bucks')
  })
  it('a "Crafted" method in a game without crafting reads as a plain method', () => {
    const w = howToGetWays({
      name: 'Y',
      gameName: sab.gameName,
      shortName: sab.shortName,
      h: howTo({ status: 'obtainable', method: 'Crafted from three Lucky Blocks.', costs: '3 Lucky Blocks per craft' }),
      cheapestUsd: null,
      vocab: sab.vocab,
    })
    expect(w.free.heading).toBe('How To Get It In-Game')
    expect(w.body).not.toMatch(/Crafting Station/)
  })
})
