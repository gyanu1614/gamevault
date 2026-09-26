/**
 * Step 7a — per-game revalidation for the value item pages. The anchor's
 * only job is to attach `values:<game>` to whatever render calls it, so
 * revalidateTag(valuesTag(game)) marks that game's pages stale and no other's.
 */
import { describe, it, expect, vi } from 'vitest'

const unstable_cache = vi.fn((fn: () => Promise<unknown>, _keys: string[], _opts: { tags: string[] }) => fn)
vi.mock('next/cache', () => ({ unstable_cache: (...a: [() => Promise<unknown>, string[], { tags: string[] }]) => unstable_cache(...a) }))

import { bindValuesTag, valuesTag } from './revalidation'

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
})
