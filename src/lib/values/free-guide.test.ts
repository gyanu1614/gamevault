import { describe, it, expect } from 'vitest'
import {
  MM2_ECONOMY,
  approx,
  checkedMonthYear,
  codeMonthYear,
  codeSortKey,
  expectedSpins,
  formatCheckedDate,
  formatCodeWhen,
  freeGuideLastmod,
  freeWay,
  getFreeGuide,
  newestExpiredCode,
  roundsFor,
  sortCodesNewestFirst,
  seerSpins,
  spinsForChance,
} from './free-guide'
import { sharedWeaponBoxOdds, shopBoxes, weaponBoxes } from './shop-boxes'

const guide = getFreeGuide('murder-mystery-2')!

describe('free guide seed', () => {
  it('loads MM2 and nothing else', () => {
    expect(guide.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(getFreeGuide('adopt-me')).toBeNull()
    expect(freeGuideLastmod('murder-mystery-2')).toBe(`${guide.checkedAt}T00:00:00Z`)
    expect(freeGuideLastmod('adopt-me')).toBeNull()
  })

  it('has the researched shape: 10 ways, 0 working codes, 17 expired, 6 scams', () => {
    expect(guide.ways).toHaveLength(10)
    expect(guide.codes.working).toEqual([])
    expect(guide.codes.expired).toHaveLength(17)
    expect(guide.scams).toHaveLength(6)
    expect(newestExpiredCode(guide)?.code).toBe('COMB4T2')
  })
})

describe('the economy constants are the seed’s own numbers', () => {
  it('spin price, coin bag, shards and the Seer recipe', () => {
    const boxes = freeWay(guide, 'coins-and-boxes').costOrTime!
    expect(boxes).toContain('1,000 Coins per spin')
    expect(boxes).toContain(`caps at ${MM2_ECONOMY.coinsPerRound} Coins a round`)
    expect(boxes).toContain(`(${MM2_ECONOMY.eliteCoinsPerRound} with the paid Elite Gamepass)`)
    const craft = freeWay(guide, 'salvage-and-craft')
    expect(craft.how).toContain(`gives ${MM2_ECONOMY.shardsPerSalvage} shards`)
    expect(craft.how).toContain(`${MM2_ECONOMY.shardsPerCraft} Common shards = random Uncommon`)
    expect(craft.how).toContain(`${MM2_ECONOMY.seerLegendaryShards} Legendary shards = Seer`)
  })
})

describe('the maths reproduces the research', () => {
  const odds = sharedWeaponBoxOdds('murder-mystery-2')!

  it('every weapon box in the Shop shares one set of odds', () => {
    expect(odds).toEqual({ common: 70, uncommon: 15, rare: 10, legendary: 5, godly: 0.2, chroma: 0.004 })
    expect(weaponBoxes('murder-mystery-2')).toHaveLength(11)
    expect(shopBoxes('murder-mystery-2').filter((b) => b.kind === 'egg')).toHaveLength(1)
    // 12 Godly weapons: Mystery Box 2 holds two.
    expect(weaponBoxes('murder-mystery-2').flatMap((b) => b.godlies)).toHaveLength(12)
    expect(weaponBoxes('murder-mystery-2').flatMap((b) => b.chromas)).toHaveLength(12)
  })

  it('Godly: 500 spins on average, 347 for 50%, ~1,150 for 90% (seed: odds line)', () => {
    const line = freeWay(guide, 'coins-and-boxes').odds!
    expect(expectedSpins(odds.godly)).toBe(500)
    expect(line).toContain('500 spins (500,000 Coins, ~12,500 full-bag rounds)')
    expect(roundsFor(500 * MM2_ECONOMY.spinCoins)).toBe(12_500)
    expect(spinsForChance(odds.godly, 0.5)).toBe(347)
    expect(line).toContain('347 spins')
    expect(approx(spinsForChance(odds.godly, 0.9), 10)).toBe(1150)
    expect(line).toContain('~1,150 spins')
  })

  it('Chroma: 25,000 spins on average', () => {
    expect(Math.round(expectedSpins(odds.chroma))).toBe(25_000)
    expect(freeWay(guide, 'coins-and-boxes').odds).toContain('25,000 spins (25 million Coins)')
  })

  it('Seer: about 135 spins when every drop is salvaged (seed: cost line)', () => {
    expect(Math.round(seerSpins(odds))).toBe(135)
    expect(freeWay(guide, 'salvage-and-craft').costOrTime).toContain('about 135 box spins (~135,000 Coins, ~3,400 full-bag rounds)')
    expect(approx(roundsFor(Math.round(seerSpins(odds)) * MM2_ECONOMY.spinCoins), 100)).toBe(3400)
  })
})

describe('dates', () => {
  it('formats the check date and the H1 month', () => {
    expect(formatCheckedDate('2026-10-05')).toBe('October 5, 2026')
    expect(checkedMonthYear('2026-10-05')).toBe('October 2026')
  })

  it('formats seed date lines', () => {
    expect(formatCodeWhen('2014-12-28, about 48 hours')).toBe('Dec 28, 2014, about 48 hours')
    expect(formatCodeWhen('2014-12-28/29, about 48 hours')).toBe('Dec 28–29, 2014, about 48 hours')
    expect(formatCodeWhen('2014-12-31 to 2015-01-01')).toBe('Dec 31, 2014 to Jan 1, 2015')
    expect(formatCodeWhen('Pre-2019; exact date not recorded')).toBe('Pre-2019; exact date not recorded')
  })

  it('sorts codes newest first, undated last', () => {
    expect(codeSortKey('About 2020-05-02 (May 2020 Update)')).toBe('2020-05-02')
    expect(codeSortKey('Pre-2019; exact date not recorded')).toBe('')
    expect(codeMonthYear('About 2020-05-02 (May 2020 Update)')).toBe('May 2020')
    expect(codeMonthYear('Pre-2019; exact date not recorded')).toBeNull()
    const order = sortCodesNewestFirst(guide.codes.expired).map((c) => c.code)
    expect(order.slice(0, 3)).toEqual(['COMB4T2', 'HW2017', 'PATR1CK'])
    // Undated codes after every dated one, in the seed's order.
    expect(order.slice(-6)).toEqual(['B4CK2SK00L', 'N3XTL3V3L', 'PR1SM', 'AL3X', 'C0RL', 'D3NIS', 'SK3TCH', 'SUB0'].slice(-6))
  })
})
