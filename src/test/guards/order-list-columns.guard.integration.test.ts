/**
 * Order lists carry only what that party may see (integration) —
 * ordersApi / buyerOrdersApi in src/lib/api/seller-compatible.ts, run with
 * each party's real browser-style session client.
 *   · the column lists are valid against the schema (a typo'd column is a
 *     400 here, not an empty Orders page in prod);
 *   · the seller's rows carry no buyer payment fields, the buyer's rows no
 *     seller payout / fee snapshot — the same split as redactOrderFor.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, promoteToEstablishedSeller, activateFixtureListing, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () =>
    new Proxy({}, {
      get: (_t, key) => {
        const v = state.client?.[key]
        return typeof v === 'function' ? v.bind(state.client) : v
      },
    }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/actions/revalidate-listing-surfaces', () => ({ revalidateMyListingSurfaces: async () => undefined }))
vi.mock('@/lib/actions/listings', () => ({ updateListing: async () => undefined, bulkUpdateListings: async () => undefined }))

import { ordersApi, buyerOrdersApi } from '@/lib/api/seller-compatible'

const SELLER_PRIVATE = ['seller_commission_pct', 'seller_fee_trace', 'platform_fee', 'platform_fee_rate', 'stripe_transfer_id', 'seller_payout']
const BUYER_PRIVATE = [
  'checkout_url', 'wallet_amount_used', 'promo_code_id', 'promo_discount', 'payment_processing_fee',
  'payment_processing_fee_rate', 'provider_charge_id', 'stripe_payment_intent_id', 'payment_provider',
  'buyer_fee_pct', 'buyer_fee_amount', 'buyer_fee_method', 'instant_delivery_code',
]

let fx: Fixture | null = null
let orderId = ''

describe.skipIf(!hasEnv)('order list columns per party (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    // The fixture order, paid so the seller's list shows it too.
    orderId = fx.pendingOrderId
    const { error } = await (fx.svc.rpc as any)('safedrop_transition', {
      p_order_id: orderId, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null,
    })
    if (error) throw new Error(`charge: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: orderId })
    await fx.cleanup()
  }, 60_000)

  it("seller's Sold list: the order, its payout, none of the buyer's payment fields", async () => {
    state.client = fx!.seller.client
    const rows = (await ordersApi.getAll()) as any[]
    const row = rows.find((r) => r.id === orderId)
    expect(row, 'seller list has the paid order').toBeTruthy()
    expect(row).toHaveProperty('seller_payout')
    expect(row.listing?.id).toBe(fx!.listingId)
    for (const k of BUYER_PRIVATE) expect(row, k).not.toHaveProperty(k)
    const one = (await ordersApi.getById(orderId)) as any
    for (const k of BUYER_PRIVATE) expect(one, k).not.toHaveProperty(k)
  })

  it("buyer's Purchases list: the order and its total, none of the seller's fields", async () => {
    state.client = fx!.buyer.client
    const rows = (await buyerOrdersApi.getAll()) as any[]
    const row = rows.find((r) => r.id === orderId)
    expect(row, 'buyer list has the order').toBeTruthy()
    expect(row).toHaveProperty('total_amount')
    expect(row.listing?.game_category_id).toBeTruthy()
    for (const k of SELLER_PRIVATE) expect(row, k).not.toHaveProperty(k)
    const one = (await buyerOrdersApi.getById(orderId)) as any
    for (const k of SELLER_PRIVATE) expect(one, k).not.toHaveProperty(k)
  })
})
