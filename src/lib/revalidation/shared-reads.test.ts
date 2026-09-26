/**
 * Step 7b — reads that are identical on every category page (paused sellers,
 * test sellers) are unstable_cache'd under a tag: fetched once per build
 * instead of once per prerendered page, and refreshed by the event that
 * changes them (setStorePaused revalidates PAUSED_SELLERS_TAG).
 */
import { describe, it, expect, vi } from 'vitest'
import { createSupabaseRecorder } from '@/test/fakes/supabase-recorder'

const cacheCalls: Array<{ keys: string[]; opts: { tags?: string[]; revalidate?: number | false } }> = []
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>, keys: string[], opts: { tags?: string[]; revalidate?: number | false }) => {
    cacheCalls.push({ keys, opts })
    return fn
  },
  revalidateTag: () => undefined,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used')
  },
}))
// DLT-001: getTestSellerIds reads the public_profiles projection, not the
// base table — anon holds no grant on profiles' sensitive columns.
const recorder = createSupabaseRecorder({ seller_presence: [{ seller_id: 's1' }], public_profiles: [{ id: 't1' }] })
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => recorder.client }))

import { PAUSED_SELLERS_TAG, TEST_SELLERS_TAG } from './tags'

describe('shared category-page reads are tagged caches', () => {
  it('getPausedSellerIds caches under PAUSED_SELLERS_TAG', async () => {
    const { getPausedSellerIds } = await import('@/lib/actions/seller-presence')
    await expect(getPausedSellerIds()).resolves.toEqual(['s1'])
    expect(cacheCalls.some((c) => c.opts.tags?.includes(PAUSED_SELLERS_TAG))).toBe(true)
  })

  it('getTestSellerIds caches under TEST_SELLERS_TAG', async () => {
    const { getTestSellerIds } = await import('@/lib/seo/public-hygiene')
    await expect(getTestSellerIds()).resolves.toEqual(['t1'])
    expect(cacheCalls.some((c) => c.opts.tags?.includes(TEST_SELLERS_TAG))).toBe(true)
  })
})
