import { describe, expect, it } from 'vitest'
import { isNewIndexable, isNewItem, NEW_ITEM_DAYS } from './new-item'

const NOW = Date.parse('2026-10-22T12:00:00Z')

describe('isNewItem (owner, 2026-10-21: a New badge for items from the wiki)', () => {
  it('a known release date decides: within 14 days is new', () => {
    expect(NEW_ITEM_DAYS).toBe(14)
    expect(isNewItem({ releasedAt: '2026-10-18', addedAt: '2026-10-22T09:00:00Z' }, NOW)).toBe(true)
    expect(isNewItem({ releasedAt: '2026-10-07', addedAt: '2026-10-22T09:00:00Z' }, NOW)).toBe(false)
  })

  it('without a release date, the day we added it decides (a backlog import never looks new by date alone)', () => {
    expect(isNewItem({ releasedAt: null, addedAt: '2026-10-20T09:00:00Z' }, NOW)).toBe(true)
    expect(isNewItem({ releasedAt: null, addedAt: '2026-07-23T22:29:28Z' }, NOW)).toBe(false)
  })

  it('no dates, a bad date, or a date far in the future is not new', () => {
    expect(isNewItem({}, NOW)).toBe(false)
    expect(isNewItem({ releasedAt: 'soon' }, NOW)).toBe(false)
    expect(isNewItem({ releasedAt: '2026-11-30' }, NOW)).toBe(false)
  })
})

describe('isNewIndexable (owner, 2026-10-21: new items with facts may rank before they have prices)', () => {
  const facts = { hasHowToGet: true, hasReleaseInfo: true }
  it('new within 30 days AND How To Get AND release info', () => {
    expect(isNewIndexable({ ...facts, releasedAt: '2026-10-01' }, NOW)).toBe(true)
    expect(isNewIndexable({ ...facts, releasedAt: null, addedAt: '2026-09-25T00:00:00Z' }, NOW)).toBe(true)
    expect(isNewIndexable({ ...facts, releasedAt: '2026-09-10' }, NOW)).toBe(false)
  })
  it('never without the facts that make the page worth reading', () => {
    expect(isNewIndexable({ hasHowToGet: false, hasReleaseInfo: true, releasedAt: '2026-10-20' }, NOW)).toBe(false)
    expect(isNewIndexable({ hasHowToGet: true, hasReleaseInfo: false, releasedAt: '2026-10-20' }, NOW)).toBe(false)
  })
})
