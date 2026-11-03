/**
 * The seller API's queries run against the real schema (integration).
 *
 * Found in the production Postgres log on 2026-11-03: 40 errors a day from
 * `withdrawal_requests.processed_at` and 36 from `reviews.reviewed_user_id`.
 * Neither column exists. The first error was swallowed, so every seller saw an
 * empty payout history; the second broke the seller reviews page. These call
 * the real API objects, as a signed-in seller, on the local stack.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let client: SupabaseClient | null = null

vi.mock('@/lib/api/seller/client', () => ({
  get supabase() {
    return client
  },
}))

let fx: Fixture | null = null

describe.skipIf(!hasEnv)('seller API queries match the schema (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    client = fx.seller.client
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  it('payout history reads withdrawal_requests without an error', async () => {
    const { earningsApi } = await import('@/lib/api/seller/earnings')
    await expect(earningsApi.getPayouts()).resolves.toEqual([])
  })

  it('the reviews list and stats read reviews without an error', async () => {
    const { reviewsApi } = await import('@/lib/api/seller/reviews')
    await expect(reviewsApi.getAll()).resolves.toEqual([])
    await expect(reviewsApi.getStats()).resolves.toMatchObject({ totalReviews: 0 })
  })
})
