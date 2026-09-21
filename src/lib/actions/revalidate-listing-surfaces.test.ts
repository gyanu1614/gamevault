/**
 * Step 7b — the browser-side seller API (lib/api/seller-compatible) writes
 * listings under RLS and cannot call revalidateTag. It calls this action
 * instead. The action must not take ids from the client: revalidation
 * re-renders pages (CPU), so it only ever touches the categories the CALLER
 * owns listings in, requires a session, and is rate-limited.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '@/test/fakes/supabase-recorder'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))
let limited: { error: string; rateLimited: true; retryAfter: number } | null = null
vi.mock('@/lib/security/rate-limit', () => ({ rateLimitAction: async () => limited }))

let recorder: SupabaseRecorder
let user: { id: string } | null = { id: 'seller-1' }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    ...recorder.client,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  }),
}))

import { revalidateMyListingSurfaces } from './revalidate-listing-surfaces'

describe('revalidateMyListingSurfaces', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
    limited = null
    user = { id: 'seller-1' }
  })

  it("revalidates exactly the caller's categories, resolved server-side", async () => {
    recorder = createSupabaseRecorder({ listings: [{ game_category_id: 'c1' }, { game_category_id: 'c2' }] })
    const r = await revalidateMyListingSurfaces()
    expect(r).toEqual({ ok: true, tags: ['listings:category:c1', 'listings:category:c2'] })
    const sellerLookup = recorder.queries.find((q) => q.table === 'listings')
    expect(sellerLookup?.calls).toContain('in')
  })

  it('refuses without a session and touches nothing', async () => {
    user = null
    recorder = createSupabaseRecorder({ listings: [{ game_category_id: 'c1' }] })
    await expect(revalidateMyListingSurfaces()).resolves.toEqual({ ok: false, error: 'Not authenticated' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('is rate-limited before any lookup', async () => {
    limited = { error: 'Too many attempts.', rateLimited: true, retryAfter: 42 }
    recorder = createSupabaseRecorder({ listings: [{ game_category_id: 'c1' }] })
    await expect(revalidateMyListingSurfaces()).resolves.toEqual({ ok: false, error: 'Too many attempts.' })
    expect(recorder.tables()).toEqual([])
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
