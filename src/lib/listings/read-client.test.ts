/**
 * The listing read clients cache every response under the tags the listing
 * mutation seam (revalidateListingSurfaces) revalidates — the contract that
 * makes a listing edit refresh the DATA on its pages, not just the shell.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseRecorder } from '@/test/fakes/supabase-recorder'

const created: Array<{ tags: string[]; revalidate?: number | false }> = []
vi.mock('@/lib/supabase/anon', () => ({
  createTaggedAnonClient: (opts: { tags: string[]; revalidate?: number | false }) => {
    created.push(opts)
    return { marker: 'tagged' }
  },
}))
const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}))

import { createCategoryListingsReadClient, createHomeListingsReadClient } from './read-client'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'

describe('listing read clients', () => {
  beforeEach(() => {
    created.length = 0
    revalidateTag.mockClear()
  })

  it('category reads: one listings:category tag per row, deduped, no own window', () => {
    createCategoryListingsReadClient(['c1', 'c2', 'c1'])
    expect(created[0].tags).toEqual(['listings:category:c1', 'listings:category:c2'])
    // The page's segment window applies; a shorter one would cap its ISR interval.
    expect(created[0].revalidate).toBeUndefined()
  })

  it('homepage reads: listings:home', () => {
    createHomeListingsReadClient()
    expect(created[0].tags).toEqual(['listings:home'])
  })

  it('a listing mutation revalidates every tag its category page and the homepage read under', async () => {
    const recorder = createSupabaseRecorder({ listings: [{ game_category_id: 'c7' }] })
    await revalidateListingSurfaces(recorder.client, { listingIds: ['l1'] })
    const revalidated = revalidateTag.mock.calls.map((c) => c[0])

    createCategoryListingsReadClient(['c7'])
    createHomeListingsReadClient()
    for (const { tags } of created) {
      for (const tag of tags) expect(revalidated).toContain(tag)
    }
  })
})
