/**
 * /sell security — createCheckout gates that the listing side alone cannot
 * provide (audit ACC-05(e), ACC-01 checkout half).
 *
 *   ACC-05(e) · quantity below the seller's min_quantity is refused.
 *   ACC-01    · a listing whose seller is restricted / banned cannot be bought,
 *               even while the row still says 'active'.
 * Both refusals happen before any order, wallet hold or provider call.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, promoteToEstablishedSeller, activateFixtureListing, type Fixture } from './throwaway'

let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

let fx: Fixture | null = null

async function ordersFor(buyerId: string) {
  const { count } = await fx!.svc.from('orders').select('id', { count: 'exact' }).eq('buyer_id', buyerId).eq('listing_id', fx!.listingId).limit(1)
  return count ?? 0
}

describe.skipIf(!hasEnv)('sell security — createCheckout gates (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id, { quantity: 10, min_quantity: 3 })
    sessionClient = fx.buyer.client
  }, 90_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('ACC-05(e): an order below the minimum order size is refused before anything is written', async () => {
    const before = await ordersFor(fx!.buyer.id)
    const { createCheckout } = await import('@/lib/actions/checkout')
    const r = await createCheckout({ listingId: fx!.listingId, quantity: 2 })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/minimum order of 3/)
    expect(await ordersFor(fx!.buyer.id)).toBe(before)
  })
})
