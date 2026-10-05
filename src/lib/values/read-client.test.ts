/**
 * The values read clients pick the tag set the publish step revalidates
 * (lib/values/revalidation.ts): item pages read under the item's price tag +
 * the game tag — NEVER the game price (list) tag — and list pages under the
 * list tag + the game tag.
 */
import { describe, it, expect, vi } from 'vitest'

const created: Array<{ tags: string[]; revalidate?: number | false }> = []
vi.mock('@/lib/supabase/anon', () => ({
  createTaggedAnonClient: (opts: { tags: string[]; revalidate?: number | false }) => {
    created.push(opts)
    return { marker: 'tagged' }
  },
}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { createValueItemReadClient, createValueListReadClient, createValuesReadClient } from './read-client'

describe('values read clients', () => {
  it('item reads: [price:<game>:<item>, values:<game>] and never price:<game>', () => {
    created.length = 0
    createValueItemReadClient('adopt-me', 'owl')
    expect(created[0].tags).toEqual(['price:adopt-me:owl', 'values:adopt-me'])
    expect(created[0].tags).not.toContain('price:adopt-me')
    // No own window: the item page's 7-day segment window applies.
    expect(created[0].revalidate).toBeUndefined()
  })

  it('list reads: [price:<game>, values:<game>]', () => {
    created.length = 0
    createValueListReadClient('steal-a-brainrot')
    expect(created[0].tags).toEqual(['price:steal-a-brainrot', 'values:steal-a-brainrot'])
  })

  it('a shared loader picks by scope', () => {
    created.length = 0
    createValuesReadClient({ gameSlug: 'steal-an-egg' })
    createValuesReadClient({ gameSlug: 'steal-an-egg', itemSlug: 'cosmic-egg' })
    expect(created.map((c) => c.tags)).toEqual([
      ['price:steal-an-egg', 'values:steal-an-egg'],
      ['price:steal-an-egg:cosmic-egg', 'values:steal-an-egg'],
    ])
  })
})
