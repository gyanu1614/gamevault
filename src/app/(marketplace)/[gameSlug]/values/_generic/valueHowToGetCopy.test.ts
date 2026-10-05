import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHowToGet, type ValueHowToGet } from '@/lib/values/how-to-get'
import {
  boxName,
  howToGetFaqs,
  howToGetWays,
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
  const ways = (name: string, h: ValueHowToGet, cheapestUsd: number | null = 2.17) =>
    howToGetWays({ name, gameName: 'Murder Mystery 2', shortName: 'MM2', h, cheapestUsd, earnRate: { unit: 'Coins', perRound: 40 } })

  it('titles the section with the search phrase and answers yes/free first', () => {
    const w = ways('Chroma Lightbringer', chromaLightbringer)
    expect(w.title).toBe('How To Get Chroma Lightbringer for Free in Murder Mystery 2')
    expect(w.lead).toBe('Yes, you can get Chroma Lightbringer for free in MM2 from Mystery Box 2.')
    expect(w.body).toBe(
      'It’s a 0.004% chance per spin, so expect about 25,000 spins — 25,000,000 Coins, or about 625,000 rounds of play. ' +
        'Most players skip the grind and buy it from $2.17, delivered in minutes.',
    )
  })

  it('way 1: short steps with real numbers and the honest total', () => {
    const f = ways('Chroma Lightbringer', chromaLightbringer).free
    expect(f.state).toBe('available')
    expect(f.heading).toBe('How To Get It For Free')
    expect(f.steps.map((s) => [s.title, s.value])).toEqual([
      ['Earn Coins', 'Up to 40 Coins per round'],
      ['Open Mystery Box 2', 'In the in-game Shop'],
      ['Spin It', '1,000 Coins, 100 Diamonds or 1 Mystery Key per spin'],
      ['Land The Drop', '0.004% per spin — about 25,000 spins'],
    ])
    expect(f.total).toEqual({ label: 'Total', value: '25,000,000 Coins', detail: 'You’d have to play about 625,000 rounds to get it.' })
  })

  it('way 2: DropMarket → buy → delivered in minutes', () => {
    const fast = ways('Chroma Lightbringer', chromaLightbringer).fast
    expect(fast.heading).toBe('Buy It for Cheap')
    expect(fast.steps.map((s) => s.title)).toEqual(['Open DropMarket', 'Buy Chroma Lightbringer', 'Get It In Minutes'])
    expect(fast.steps[1].value).toBe('From $2.17, reputable sellers')
    expect(fast.total).toEqual({
      label: 'Total Cost',
      value: 'Around $2.17',
      detail: 'Sold by ID-verified sellers · Safe and quick service.',
    })
  })

  it('never gives a rounds figure without a verified earn rate', () => {
    const w = howToGetWays({ name: 'X', gameName: 'Murder Mystery 2', shortName: 'MM2', h: chromaLightbringer, cheapestUsd: null })
    expect(w.free.total?.detail).toBe('About 25,000 spins on average to get it.')
    expect(w.body).not.toMatch(/rounds/)
  })

  it('turns a recipe into craft steps', () => {
    const w = ways('Seer', seer, 0.29)
    expect(w.title).toBe('How To Get Seer for Free in Murder Mystery 2')
    expect(w.lead).toBe('Yes, you can craft Seer for free in MM2.')
    expect(w.free.steps.map((s) => s.title)).toEqual(['Collect 20 Legendary Shards', 'Open The Crafting Station', 'Craft Seer'])
    expect(w.free.steps[0].value).toBe('Salvage at least 10 Legendary weapons')
  })

  it('says plainly when the free way has ended — no "for free" in the title', () => {
    const w = ways('Harvester', harvester, 7.2)
    expect(w.title).toBe('How To Get Harvester in Murder Mystery 2')
    expect(w.lead).toBe('There’s no free way to get Harvester in MM2 anymore.')
    expect(w.free.state).toBe('gone')
    expect(w.free.steps[0]).toEqual({ icon: 'history', title: 'How It Was Obtained', value: 'Tier 30 reward of the Halloween 2021 event pass' })
    expect(w.body).toMatch(/from \$7\.20/)
  })

  it('never implies an unconfirmed item can be obtained', () => {
    const w = ways('Beachy', beachy)
    expect(w.free.state).toBe('unconfirmed')
    expect(w.free.steps).toEqual([])
    expect(`${w.title} ${w.lead} ${w.body}`).not.toMatch(/Yes|for free in|1,699|3,399/)
  })

  it('uses "hatch" for pets from an egg', () => {
    const fireCat: ValueHowToGet = {
      ...base,
      status: 'obtainable',
      method: 'Hatched from the Common Egg in the in-game Shop (Chroma drop).',
      costs: '1,000 Coins or 100 Diamonds per hatch',
      odds: '0.004% per hatch',
    }
    const f = ways('Chroma Fire Cat', fireCat).free
    expect(f.heading).toBe('How To Get It For Free')
    expect(f.steps.map((s) => s.title)).toEqual(['Earn Coins', 'Open Common Egg', 'Hatch It', 'Land The Drop'])
    expect(f.steps[3].value).toBe('0.004% per hatch — about 25,000 hatches')
  })

  it('finds the box name in the method', () => {
    expect(boxName(chromaLightbringer.method)).toBe('Mystery Box 2')
    expect(boxName('Tier 30 reward of the Halloween 2021 event pass.')).toBeNull()
  })

  it('answers the searches people make: "how do you get X" and "can you get X for free"', () => {
    const input = { name: 'Chroma Lightbringer', gameName: 'Murder Mystery 2', shortName: 'MM2', h: chromaLightbringer, cheapestUsd: 2.17, earnRate: { unit: 'Coins', perRound: 40 } }
    const [how, free] = howToGetFaqs(input)
    const w = howToGetWays(input)
    expect(how.q).toBe('How do you get Chroma Lightbringer in MM2?')
    expect(how.a).toMatch(/^Yes, you can get Chroma Lightbringer for free in MM2 from Mystery Box 2\. /)
    expect(how.a).toMatch(/The free way, step by step: 1\. Earn Coins \(Up to 40 Coins per round\)\./)
    expect(how.a).toMatch(/The fast way: 1\. Open DropMarket\. 2\. Buy Chroma Lightbringer\. 3\. Get It In Minutes\.$/)
    expect(free).toEqual({ q: 'Can you get Chroma Lightbringer for free in Murder Mystery 2?', a: `${w.lead} ${w.body}` })
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
    const qs = itemFaq(
      input,
      howToGetFaqs({ name: 'Harvester', gameName: 'Murder Mystery 2', shortName: 'MM2', h: harvester, cheapestUsd: 7.2 }),
    ).map((f) => f.q)
    expect(qs.slice(1, 3)).toEqual(['How do you get Harvester in MM2?', 'Can you get Harvester for free in Murder Mystery 2?'])
    expect(qs.some((q) => q.startsWith('Where does'))).toBe(false)
    expect(itemFaq(input).map((f) => f.q)[1]).toBe('Where does Harvester come from?')
  })

  it('builds both ways for every entry of the shipped dataset; every obtainable item gets steps', () => {
    const entries = JSON.parse(readFileSync('scripts/values-seeds/murder-mystery-2.how-to-get.json', 'utf8')) as Array<
      Record<string, unknown> & { slug: string; name: string }
    >
    expect(entries.length).toBeGreaterThanOrEqual(100)
    for (const e of entries) {
      const h = parseHowToGet(e)
      expect(h, e.slug).not.toBeNull()
      const w = howToGetWays({ name: e.name, gameName: 'Murder Mystery 2', shortName: 'MM2', h: h!, cheapestUsd: 1 })
      expect(w.lead, e.slug).toBeTruthy()
      if (h!.status === 'obtainable') expect(w.free.steps.length, e.slug).toBeGreaterThan(0)
      // "for free" is only ever promised when it's true.
      if (h!.status !== 'obtainable') expect(`${w.title} ${w.lead} ${w.body}`, e.slug).not.toMatch(/\bfor free\b/)
    }
  })
})
