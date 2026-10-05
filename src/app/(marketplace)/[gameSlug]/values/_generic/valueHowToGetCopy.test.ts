import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHowToGet, type ValueHowToGet } from '@/lib/values/how-to-get'
import {
  boxName,
  checkedLabel,
  howToGetFaqs,
  howToGetGuide,
  howToGetNote,
  howToGetSources,
  howToGetStatusMeta,
} from './valueHowToGetCopy'
import { itemFaq, type ItemCopyInput } from './valueListItemCopy'

const base: Omit<ValueHowToGet, 'status' | 'method'> = {
  sources: ['https://murder-mystery-2.fandom.com/wiki/Chroma_Lightbringer', 'https://murder-mystery-2.fandom.com/wiki/Mystery_Box_2'],
  confidence: 'high',
  checkedAt: '2026-10-05',
  costs: null,
  odds: null,
  released: null,
  note: null,
}

const chromaLightbringer: ValueHowToGet = {
  ...base,
  status: 'obtainable',
  method: 'Unboxed from Mystery Box 2 in the in-game Shop (Chroma drop).',
  costs: '1,000 Coins, 100 Diamonds or 1 Mystery Key per spin',
  odds: '0.004% per spin',
  released: 'March 2020 update',
  note: 'The regular Lightbringer drops from the same box at 0.2%.',
}
const seer: ValueHowToGet = {
  ...base,
  status: 'obtainable',
  method: 'Crafted at the Crafting Station from 20 Legendary Shards (made by salvaging Legendary weapons).',
  costs: '20 Legendary Shards (salvage at least 10 Legendary weapons)',
}
const harvester: ValueHowToGet = {
  ...base,
  status: 'unobtainable',
  method: 'Tier 30 reward of the Halloween 2021 event pass.',
  costs: '80,000 Candies (2021)',
  released: '2021 (Halloween Event 2021)',
  note: 'Event-exclusive: it did not return in later events. Trading or buying is the only way now.',
}
const beachy: ValueHowToGet = {
  ...base,
  status: 'unknown',
  confidence: 'low',
  method: 'Sold for Robux via the Beachy Gamepass or the Beach Bundle during the Summer 2026 event (Jul 23 - Aug 23, 2026).',
  costs: '1,699 Robux alone, 3,399 Robux in the Beach Bundle',
  released: '2026 (Summer Event 2026)',
  note: 'Sources conflict. Show trade/buy only.',
  sources: [
    'https://murder-mystery-2.fandom.com/wiki/Beachy',
    'https://apis.roblox.com/game-passes/v1/universes/66654135/game-passes?passView=Full&pageSize=100',
  ],
}

describe('how-to-get copy', () => {
  it('labels each status with a quiet pill', () => {
    expect(howToGetStatusMeta('obtainable')).toEqual({ label: 'Obtainable Now', dot: 'bg-success' })
    expect(howToGetStatusMeta('unobtainable').label).toBe('No Longer Obtainable')
    expect(howToGetStatusMeta('unknown')).toEqual({ label: 'Unconfirmed', dot: 'bg-warning' })
    expect(howToGetStatusMeta('seasonal')).toEqual({ label: 'Returns Seasonally', dot: 'bg-info' })
  })

  const guide = (name: string, h: ValueHowToGet, cheapestUsd: number | null = 2.17) =>
    howToGetGuide({ name, shortName: 'MM2', h, cheapestUsd })

  it('answers first, like a guide: yes, free, and the honest maths for a box drop', () => {
    const g = guide('Chroma Lightbringer', chromaLightbringer)
    expect(g.lead).toBe('Yes, you can get Chroma Lightbringer for free in MM2.')
    expect(g.body).toBe(
      'It drops from Mystery Box 2, and you can spin it with Coins you earn by playing. ' +
        'It’s a 0.004% chance, so it takes about 25,000 spins (25,000,000 Coins) on average. ' +
        'That’s why most players buy or trade for it instead, from $2.17.',
    )
    expect(g.steps.map((s) => s.title)).toEqual(['Earn Coins', 'Open Mystery Box 2', 'Spin It', 'Keep Spinning'])
    expect(g.steps[0].body).toBe('Play rounds to earn Coins. Diamonds or Mystery Keys work too.')
    expect(g.steps[2].body).toBe('Each spin costs 1,000 Coins, 100 Diamonds or 1 Mystery Key.')
    expect(g.buyLabel).toBe('Or Skip The Grind')
    expect(g.history).toBe('Released March 2020 update.')
  })

  it('turns a recipe into craft steps', () => {
    const g = guide('Seer', seer, 0.29)
    expect(g.lead).toBe('Yes, you can craft Seer for free in MM2.')
    expect(g.steps.map((s) => s.title)).toEqual(['Collect 20 Legendary Shards', 'Open The Crafting Station', 'Craft Seer'])
    expect(g.steps[0].body).toBe('Salvage at least 10 Legendary weapons.')
  })

  it('says no plainly when it cannot be obtained, and keeps the history', () => {
    const g = guide('Harvester', harvester, 7.2)
    expect(g.lead).toBe('No, Harvester can’t be obtained in MM2 anymore.')
    expect(g.body).toMatch(/no free way to get it now/)
    expect(g.steps.map((s) => s.title)).toEqual(['Check What It’s Worth', 'Buy Or Trade For It', 'Get It In-Game'])
    expect(g.steps[1].body).toBe('Buy it from a reputable seller (from $7.20), or trade for it with another player.')
    expect(g.history).toBe(
      'Originally: Tier 30 reward of the Halloween 2021 event pass (80,000 Candies (2021)) · Released 2021 (Halloween Event 2021).',
    )
  })

  it('never implies an unconfirmed item can be obtained', () => {
    const g = guide('Beachy', beachy)
    expect(g.lead).toMatch(/^Unconfirmed/)
    expect(`${g.lead} ${g.body}`).not.toMatch(/Yes|for free|1,699|3,399/)
    expect(howToGetNote(beachy)).toBeNull()
    expect(howToGetFaqs({ name: 'Beachy', shortName: 'MM2', h: beachy, cheapestUsd: 3 })[0].a).not.toMatch(/Yes/)
  })

  it('uses "hatch" for pets from an egg', () => {
    const fireCat: ValueHowToGet = {
      ...base,
      status: 'obtainable',
      method: 'Hatched from the Common Egg in the in-game Shop (Chroma drop).',
      costs: '1,000 Coins or 100 Diamonds per hatch',
      odds: '0.004% per hatch',
    }
    const g = guide('Chroma Fire Cat', fireCat)
    expect(g.body).toMatch(/^It hatches from Common Egg, and you can hatch it with Coins you earn by playing\. /)
    expect(g.steps.map((s) => s.title)).toEqual(['Earn Coins', 'Open Common Egg', 'Hatch It', 'Keep Hatching'])
    expect(g.steps[3].body).toMatch(/^At 0.004% per hatch, expect about 25,000 hatches on average/)
  })

  it('finds the box name in the method', () => {
    expect(boxName(chromaLightbringer.method)).toBe('Mystery Box 2')
    expect(boxName('Tier 30 reward of the Halloween 2021 event pass.')).toBeNull()
  })

  it("doesn't repeat the trade line in an unobtainable note", () => {
    expect(howToGetNote(harvester)).toBe('Event-exclusive: it did not return in later events.')
    expect(howToGetNote({ ...harvester, note: 'Event-exclusive box; trading or buying is the only way now.' })).toBe('Event-exclusive box.')
    expect(howToGetNote({ ...harvester, note: 'Trading or buying is the only way now.' })).toBeNull()
    expect(howToGetNote(chromaLightbringer)).toBe(chromaLightbringer.note)
  })

  it('credits the wiki under its licence and dates the check', () => {
    expect(howToGetSources(chromaLightbringer)).toEqual([
      {
        label: 'Murder Mystery 2 Wiki',
        license: 'CC BY-SA 3.0',
        links: [
          { title: 'Chroma Lightbringer', href: chromaLightbringer.sources[0] },
          { title: 'Mystery Box 2', href: chromaLightbringer.sources[1] },
        ],
      },
    ])
    expect(howToGetSources(beachy)[1]).toEqual({
      label: 'Roblox',
      license: null,
      links: [{ title: 'Game Pass Listing', href: beachy.sources[1] }],
    })
    expect(checkedLabel(chromaLightbringer)).toBe('Checked Oct 5, 2026')
  })

  it('answers the searches people make: "how do you get X" and "can you get X for free"', () => {
    const [how, free] = howToGetFaqs({ name: 'Chroma Lightbringer', shortName: 'MM2', h: chromaLightbringer, cheapestUsd: 2.17 })
    expect(how.q).toBe('How do you get Chroma Lightbringer in MM2?')
    expect(how.a).toMatch(/^Yes, you can get Chroma Lightbringer for free in MM2\. /)
    expect(how.a).toMatch(/Step by step: 1\. Earn Coins — Play rounds to earn Coins/)
    expect(free).toEqual({
      q: 'Can you get Chroma Lightbringer for free in MM2?',
      a: `${guide('Chroma Lightbringer', chromaLightbringer).lead} ${guide('Chroma Lightbringer', chromaLightbringer).body}`,
    })
  })

  it('takes the "Where does it come from?" slot in the page FAQ (one FAQ list, no repeat)', () => {
    const input: ItemCopyInput = {
      name: 'Harvester',
      gameName: 'Murder Mystery 2',
      shortName: 'MM2',
      rarity: 'Ancient',
      typeNoun: 'gun',
      releaseYear: 2021,
      origin: 'Halloween Event 2021',
      obtain: [],
      cheapestUsd: 7.2,
      marketUsd: null,
      listedNow: 5,
      priceChangedAt: null,
      counterpart: null,
    }
    const qs = itemFaq(input, howToGetFaqs({ name: 'Harvester', shortName: 'MM2', h: harvester, cheapestUsd: 7.2 })).map((f) => f.q)
    expect(qs.slice(1, 3)).toEqual(['How do you get Harvester in MM2?', 'Can you get Harvester for free in MM2?'])
    expect(qs.some((q) => q.startsWith('Where does'))).toBe(false)
    expect(itemFaq(input).map((f) => f.q)[1]).toBe('Where does Harvester come from?')
  })

  it('builds a guide for every entry of the shipped dataset; every obtainable item gets steps', () => {
    const entries = JSON.parse(readFileSync('scripts/values-seeds/murder-mystery-2.how-to-get.json', 'utf8')) as Array<
      Record<string, unknown> & { slug: string; name: string }
    >
    expect(entries.length).toBeGreaterThanOrEqual(100)
    for (const e of entries) {
      const h = parseHowToGet(e)
      expect(h, e.slug).not.toBeNull()
      const g = howToGetGuide({ name: e.name, shortName: 'MM2', h: h!, cheapestUsd: 1 })
      expect(g.lead, e.slug).toBeTruthy()
      if (h!.status === 'obtainable') expect(g.steps.length, e.slug).toBeGreaterThan(0)
      if (h!.status !== 'obtainable') expect(`${g.lead} ${g.body}`, e.slug).not.toMatch(/\bfor free\b(?! way)/)
    }
  })
})
