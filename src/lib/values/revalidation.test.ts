/**
 * Step 7a — per-game revalidation for the value item pages. The anchor's
 * only job is to attach `values:<game>` to whatever render calls it, so
 * revalidateTag(valuesTag(game)) marks that game's pages stale and no other's.
 */
import { describe, it, expect, vi } from 'vitest'

const unstable_cache = vi.fn((fn: () => Promise<unknown>, _keys: string[], _opts: { tags: string[] }) => fn)
vi.mock('next/cache', () => ({ unstable_cache: (...a: [() => Promise<unknown>, string[], { tags: string[] }]) => unstable_cache(...a) }))

import { bindValueItemPriceTag, bindValuesTag, parseChangedSlugs, valuesTag } from './revalidation'

describe('values revalidation tags', () => {
  it('names the tag per game', () => {
    expect(valuesTag('steal-a-brainrot')).toBe('values:steal-a-brainrot')
  })

  it('anchors the render to exactly that game tag', async () => {
    await expect(bindValuesTag('adopt-me')).resolves.toBe('adopt-me')
    const [, keys, opts] = unstable_cache.mock.calls.at(-1)!
    expect(keys).toContain('adopt-me')
    expect(opts.tags).toEqual(['values:adopt-me'])
  })

  it('an item page carries ONLY its own price tag (T1)', async () => {
    // Before T1 it also carried `price:<game>`, so a "changed items" call that
    // refreshed the list pages re-marked every item page of the game stale.
    await expect(bindValueItemPriceTag('steal-a-brainrot', 'tim-cheese')).resolves.toBe('tim-cheese')
    const [, , opts] = unstable_cache.mock.calls.at(-1)!
    expect(opts.tags).toEqual(['price:steal-a-brainrot:tim-cheese'])
  })
})

describe('parseChangedSlugs', () => {
  it('null when the body has no array (the route decides: 400)', () => {
    expect(parseChangedSlugs(null)).toBeNull()
    expect(parseChangedSlugs({})).toBeNull()
    expect(parseChangedSlugs({ changedSlugs: 'owl' })).toBeNull()
  })

  it('keeps page slugs only, de-duplicated', () => {
    expect(parseChangedSlugs({ changedSlugs: ['owl', 'owl', 'frost-dragon', '../etc', 'Owl', 3, ''] })).toEqual([
      'owl',
      'frost-dragon',
    ])
  })

  it('an empty array is a valid "nothing moved"', () => {
    expect(parseChangedSlugs({ changedSlugs: [] })).toEqual([])
  })
})
