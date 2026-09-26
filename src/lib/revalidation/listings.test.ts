/**
 * Step 7b — category pages are prerendered with a 24 h TTL, so every listing
 * mutation must revalidate the category surfaces it touched. This module is
 * the ONE seam those mutations call; the guard test
 * (listing-mutations-revalidate.guard.test.ts) enforces that they do.
 *
 * Tag per game_categories row: a page render anchors to
 * `listings:category:<id>`; a mutation resolves its listing/seller to category
 * ids and revalidates those tags. Never throws — a revalidation failure must
 * not fail the mutation that already happened.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '@/test/fakes/supabase-recorder'

const revalidateTag = vi.fn()
const unstable_cache = vi.fn((fn: () => Promise<unknown>, _keys: string[], _opts: { tags: string[] }) => fn)
vi.mock('next/cache', () => ({
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  unstable_cache: (...a: [() => Promise<unknown>, string[], { tags: string[] }]) => unstable_cache(...a),
}))

import {
  categoryListingsTag,
  bindCategoryListingsTag,
  revalidateListingSurfaces,
} from './listings'

let recorder: SupabaseRecorder
const tags = () => revalidateTag.mock.calls.map((c) => c[0]).sort()

describe('listing surfaces revalidation', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
    unstable_cache.mockClear()
  })

  it('names one tag per game_categories row', () => {
    expect(categoryListingsTag('c1')).toBe('listings:category:c1')
  })

  it('anchors a render to its category tag', async () => {
    await expect(bindCategoryListingsTag('c1')).resolves.toBe('c1')
    const [, keys, opts] = unstable_cache.mock.calls.at(-1)!
    expect(keys).toContain('c1')
    expect(opts.tags).toEqual(['listings:category:c1'])
  })

  it('revalidates explicit category ids, deduped', async () => {
    recorder = createSupabaseRecorder()
    const r = await revalidateListingSurfaces(recorder.client, { gameCategoryIds: ['c1', 'c2', 'c1'] })
    expect(tags()).toEqual(['listings:category:c1', 'listings:category:c2'])
    expect(r.tags.sort()).toEqual(['listings:category:c1', 'listings:category:c2'])
    expect(recorder.tables()).toEqual([])
  })

  it('resolves listing ids to their categories with one read', async () => {
    recorder = createSupabaseRecorder({
      listings: [{ game_category_id: 'c7' }, { game_category_id: 'c7' }, { game_category_id: 'c9' }],
    })
    await revalidateListingSurfaces(recorder.client, { listingIds: ['l1', 'l2', 'l3'] })
    expect(tags()).toEqual(['listings:category:c7', 'listings:category:c9'])
    expect(recorder.tables()).toEqual(['listings'])
  })

  it("resolves a seller to every category they list in (store pause hides all of them)", async () => {
    recorder = createSupabaseRecorder({ listings: [{ game_category_id: 'c1' }, { game_category_id: 'c3' }] })
    await revalidateListingSurfaces(recorder.client, { sellerIds: ['s1'] })
    expect(tags()).toEqual(['listings:category:c1', 'listings:category:c3'])
  })

  it('never throws — a failed lookup revalidates what it can and reports it', async () => {
    recorder = createSupabaseRecorder()
    recorder.client.from = () => {
      throw new Error('db down')
    }
    const r = await revalidateListingSurfaces(recorder.client, {
      gameCategoryIds: ['c1'],
      listingIds: ['l1'],
    })
    expect(tags()).toEqual(['listings:category:c1'])
    expect(r.error).toMatch(/db down/)
  })

  it('does nothing with an empty target', async () => {
    recorder = createSupabaseRecorder()
    const r = await revalidateListingSurfaces(recorder.client, {})
    expect(r.tags).toEqual([])
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
