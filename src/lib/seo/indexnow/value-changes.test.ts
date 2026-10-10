import { describe, it, expect } from 'vitest'

import {
  VALUE_CHANGE_MIN_ABSOLUTE_USD,
  VALUE_CHANGE_MIN_RELATIVE,
  changedItemSlugs,
  isMaterialValueChange,
  valuePageUrls,
} from '@/lib/seo/indexnow/value-changes'

describe('isMaterialValueChange: a cash value moved enough to be worth a re-crawl', () => {
  it('uses a 5% and 25-cent threshold together', () => {
    expect(VALUE_CHANGE_MIN_RELATIVE).toBe(0.05)
    expect(VALUE_CHANGE_MIN_ABSOLUTE_USD).toBe(0.25)
  })
  it.each([
    [100, 106, true], // +6%, $6
    [100, 94, true],
    [100, 104, false], // +4%
    [100, 100, false],
    [2, 2.2, false], // 10% but 20 cents
    [2, 2.3, true], // 15%, 30 cents
    [0, 0.5, true], // from nothing
    [0, 0.1, false],
  ])('%s -> %s is %s', (prev, next, expected) => {
    expect(isMaterialValueChange(prev, next)).toBe(expected)
  })
  it('a price appearing or disappearing always counts; no price on either side never does', () => {
    expect(isMaterialValueChange(null, 12)).toBe(true)
    expect(isMaterialValueChange(12, null)).toBe(true)
    expect(isMaterialValueChange(null, null)).toBe(false)
  })
})

describe('changedItemSlugs', () => {
  it('lists an item once if any of its values moved materially', () => {
    expect(
      changedItemSlugs([
        { slug: 'a', previous: 10, current: 20 },
        { slug: 'a', previous: 5, current: 5 },
        { slug: 'b', previous: 10, current: 10.1 },
        { slug: 'c', previous: null, current: 3 },
      ]),
    ).toEqual(['a', 'c'])
  })
})

describe('valuePageUrls', () => {
  it('nothing changed: nothing to submit (no more "send everything")', () => {
    expect(valuePageUrls('steal-a-brainrot', [])).toEqual([])
  })
  it('the changed items plus the game pages whose numbers they feed', () => {
    expect(valuePageUrls('adopt-me', ['bat-dragon'])).toEqual([
      '/adopt-me/values/bat-dragon',
      '/adopt-me/values',
      '/adopt-me/calculator',
    ])
  })
  it('steal-a-brainrot: its landing, calculator and price index move too', () => {
    const urls = valuePageUrls('steal-a-brainrot', ['x'])
    expect(urls).toEqual(expect.arrayContaining(['/steal-a-brainrot/values/x', '/steal-a-brainrot', '/steal-a-brainrot/values', '/steal-a-brainrot/calculator', '/steal-a-brainrot/price-index']))
  })
})

const TODAY = '2026-10-02'
