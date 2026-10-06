import { describe, it, expect } from 'vitest'
import { getFreeGuide } from '@/lib/values/free-guide'
import { sharedWeaponBoxOdds } from '@/lib/values/shop-boxes'
import {
  NOTHING_HERE,
  NOTHING_ORDER,
  buyRow,
  faq,
  freeNumbers,
  lead,
  metaDescription,
  metaTitle,
  pageTitle,
  realWaysHeading,
  seerCallout,
  wayRows,
} from './_freeItemsCopy'
import { codesFacts, faq as codesFaq, lead as codesLead, pageTitle as codesTitle, rewardLabel, scamTitle, verdict } from '../codes/_codesCopy'

const ctx = { gameName: 'Murder Mystery 2', shortName: 'MM2' }
const guide = getFreeGuide('murder-mystery-2')!
const n = freeNumbers(sharedWeaponBoxOdds('murder-mystery-2')!)
const realWays = guide.ways.filter((w) => !NOTHING_HERE.has(w.slug)).length
const noPrices = () => null

describe('free items copy', () => {
  it('targets the search in the H1 and the title', () => {
    expect(pageTitle(ctx)).toBe('How to Get Free Godlies and Items in MM2 (Every Real Way, 2026)')
    expect(metaTitle(ctx)).toMatch(/^How to Get Free Godlies in MM2/)
    expect(metaDescription(ctx, n, realWays).length).toBeLessThanOrEqual(200)
  })

  it('counts 7 real ways and 3 honest "nothing here" rows', () => {
    expect(realWays).toBe(7)
    expect(realWaysHeading(ctx, realWays)).toBe('7 Real Ways to Get Free Items in MM2')
    const rows = wayRows(ctx, guide, n, noPrices)
    expect(rows.map((r) => r.slug)).toEqual(guide.ways.map((w) => w.slug))
    const nothing = NOTHING_ORDER.map((slug) => rows.find((r) => r.slug === slug)!)
    expect(nothing.map((r) => r.metric.value)).toEqual(['0 Items', 'None', 'Top 100'])
  })

  it('quotes the research numbers, derived ones "on average"', () => {
    const l = lead(ctx, n, realWays)
    expect(l.strong).toBe('There are 7 real ways to get free items in Murder Mystery 2, and no code works.')
    expect(l.rest).toContain('about 135 box spins on average')
    expect(l.rest).toContain('a 0.2% roll, about 500 spins on average')
    const rows = wayRows(ctx, guide, n, noPrices)
    const boxes = rows.find((r) => r.slug === 'coins-and-boxes')!
    expect(boxes.metric).toEqual({ value: '~500 Spins', label: 'Per Godly, on Average' })
    expect(boxes.how).toContain('A 0.2% Godly takes 500,000 Coins, about 12,500 full-bag rounds, on average.')
    const craft = rows.find((r) => r.slug === 'salvage-and-craft')!
    expect(craft.metric).toEqual({ value: '~135 Spins', label: 'Per Seer, on Average' })
    expect(craft.how).toContain('20 Legendary Shards (10 Legendaries salvaged) make a Seer.')
    expect(seerCallout(n).title).toBe('Fastest Free Godly: Seer')
  })

  it('quotes a live price only when there is one', () => {
    const withPrice = wayRows(ctx, guide, n, (s) => (s === 'raygun' ? 47.98 : null))
    expect(withPrice.find((r) => r.slug === 'event-pass')!.get).toContain('Raygun now sells for $47.98')
    expect(wayRows(ctx, guide, n, noPrices).find((r) => r.slug === 'event-pass')!.get).not.toContain('$')
    const buy = buyRow(ctx, n, { seer: 0.28, box: { name: 'Saw', usd: 0.32 }, chroma: null })
    expect(buy.cta).toBe('Buy MM2 Godlies')
    expect(buy.steps.map((s) => s.title)).toEqual(['Seer From $0.28', 'Box Godlies From $0.32'])
    expect(buyRow(ctx, n, { seer: null, box: null, chroma: null }).steps).toEqual([])
  })

  it('the FAQ reuses the visible answer', () => {
    const l = lead(ctx, n, realWays)
    const qa = faq(ctx, n, realWays, { code: 'COMB4T2', year: 'May 2020' })
    expect(qa[0].a).toBe(`${l.strong} ${l.rest}`)
    expect(qa.find((q) => q.q.includes('codes'))!.a).toContain('The last free code was COMB4T2, in May 2020.')
  })
})

describe('codes copy', () => {
  const f = codesFacts(guide)

  it('takes the H1 month from the research date, never a literal', () => {
    expect(codesTitle(ctx, f)).toBe(`MM2 Codes (${f.month}): Every Code and If Any Work`)
    expect(codesTitle(ctx, codesFacts({ ...guide, checkedAt: '2026-11-02' }))).toContain('(November 2026)')
  })

  it('says no code works only when the research found none', () => {
    expect(verdict(ctx, f)).toBe('No MM2 Code Works Right Now')
    const one = codesFacts({ ...guide, codes: { ...guide.codes, working: ['NEWCODE'] } })
    expect(verdict(ctx, one)).toBe('1 MM2 Code Works Right Now')
  })

  it('names the last free code and its date', () => {
    expect(f.last?.code).toBe('COMB4T2')
    expect(f.lastWhen).toBe('May 2020')
    expect(rewardLabel('Combat II (Common knife)')).toBe('Combat II knife')
    expect(rewardLabel('Pumpkin (Common pet)')).toBe('Pumpkin pet')
    const l = codesLead(ctx, f)
    expect(`${l.strong} ${l.rest}`).toBe(
      'No Murder Mystery 2 code works right now. The last free code, COMB4T2, came out in May 2020, and all 17 MM2 codes have expired. Here is every code, when it ran, and the code scams to avoid.',
    )
    expect(codesFaq(ctx, f)[0].a).toBe(
      'No Murder Mystery 2 code works right now. The last free code, COMB4T2, came out in May 2020, and all 17 MM2 codes have expired.',
    )
  })

  it('gives every researched scam a Title Case heading', () => {
    for (const s of guide.scams) expect(scamTitle(ctx, s.title), s.title).not.toBe(s.title)
  })
})
