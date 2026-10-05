import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHowToGet, type ValueHowToGet } from '@/lib/values/how-to-get'
import {
  checkedLabel,
  howToGetFaq,
  howToGetNote,
  howToGetPath,
  howToGetRows,
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

  it('shows only the rows that are present', () => {
    expect(howToGetRows(chromaLightbringer).map((r) => r.label)).toEqual(['Method', 'Cost', 'Odds', 'Released'])
    // Seer's cost is its recipe, shown in the Craft It panel, so no Cost row.
    expect(howToGetRows(seer).map((r) => r.label)).toEqual(['Method'])
    expect(howToGetRows(harvester).map((r) => r.label)).toEqual(['Method', 'Original Cost', 'Released'])
  })

  it('compares unboxing with buying, on average, from the stated odds', () => {
    expect(howToGetPath(chromaLightbringer)).toEqual({
      kind: 'unbox',
      copy: {
        headline: '25,000,000 Coins',
        detail: '25,000 spins at 1,000 Coins each',
        alternatives: 'or 2,500,000 Diamonds, or 25,000 Mystery Keys',
      },
    })
    expect(howToGetPath(seer)).toEqual({
      kind: 'craft',
      recipe: [{ label: '20 Legendary Shards', hint: 'salvage at least 10 Legendary weapons' }],
    })
  })

  it('is honest when it cannot be obtained, and never implies an unconfirmed item can', () => {
    expect(howToGetPath(harvester)).toEqual({ kind: 'trade', lines: ['Trading or buying is the only way to get it now.'] })
    expect(howToGetPath(beachy)).toEqual({
      kind: 'trade',
      lines: ["We couldn't confirm whether this can still be obtained.", 'Trading or buying is the sure way to get it now.'],
    })
    // No cost, odds or research memo on an unconfirmed item.
    expect(howToGetRows(beachy).map((r) => r.label)).toEqual(['Method', 'Released'])
    expect(howToGetNote(beachy)).toBeNull()
    expect(howToGetFaq('Beachy', 'MM2', beachy).a).not.toMatch(/1,699|3,399|can be obtained in MM2 now/)
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

  it('answers "How do you get X?" for the FAQ and its schema', () => {
    expect(howToGetFaq('Chroma Lightbringer', 'MM2', chromaLightbringer)).toEqual({
      q: 'How do you get Chroma Lightbringer in MM2?',
      a:
        'Chroma Lightbringer can be obtained in MM2 now. Unboxed from Mystery Box 2 in the in-game Shop (Chroma drop). ' +
        'Each spin costs 1,000 Coins, 100 Diamonds or 1 Mystery Key, and it drops at 0.004% per spin — about 25,000 spins (25,000,000 Coins) on average. ' +
        'You can also trade for it or buy it from another player.',
    })
    expect(howToGetFaq('Harvester', 'MM2', harvester).a).toBe(
      'Harvester is no longer obtainable in MM2. Tier 30 reward of the Halloween 2021 event pass. Trading or buying is the only way to get it now.',
    )
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
    const qs = itemFaq(input, howToGetFaq('Harvester', 'MM2', harvester)).map((f) => f.q)
    expect(qs[1]).toBe('How do you get Harvester in MM2?')
    expect(qs.some((q) => q.startsWith('Where does'))).toBe(false)
    expect(itemFaq(input).map((f) => f.q)[1]).toBe('Where does Harvester come from?')
  })

  it('reads every entry of the shipped dataset into a section', () => {
    const entries = JSON.parse(readFileSync('scripts/values-seeds/murder-mystery-2.how-to-get.json', 'utf8')) as Array<
      Record<string, unknown> & { slug: string }
    >
    const kinds: Record<string, number> = {}
    for (const e of entries) {
      const h = parseHowToGet(e)
      expect(h, e.slug).not.toBeNull()
      const path = howToGetPath(h!)
      kinds[path.kind] = (kinds[path.kind] ?? 0) + 1
      // Every obtainable item in the data is a box with stated odds or a recipe.
      if (h!.status === 'obtainable') expect(['unbox', 'craft'], e.slug).toContain(path.kind)
    }
    expect(kinds.trade).toBe(73)
  })
})
