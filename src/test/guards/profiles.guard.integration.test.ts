/**
 * AUTH-005 — profiles trust/status/financial columns are guarded.
 * Exploit: user self-edits seller_status / kyc_status / badges / counters.
 * Positive: a review insert still updates seller_rating (update_seller_rating
 * sets the guarded-write flag), and unprotected columns stay editable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, guardsApplied, makeFixture, expectGuardRejection, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('AUTH-005 — profiles column guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await guardsApplied(fx.svc)
    if (!ready) console.warn('[profiles guard] skipping — 20260911120000_auth_p0_column_guards.sql not applied')
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() })

  it('seller cannot self-set seller_status / kyc_status / badges / total_sales', async () => {
    if (!ready) return
    const res = await fx!.seller.client.from('profiles')
      .update({ seller_status: 'active', kyc_status: 'approved', badges: ['verified'], total_sales: 9999 })
      .eq('id', fx!.seller.id).select('id')
    expectGuardRejection(res, 'profiles')
    const { data } = await fx!.svc.from('profiles').select('kyc_status,badges,total_sales').eq('id', fx!.seller.id).single()
    expect((data as any).kyc_status).not.toBe('approved')
    expect((data as any).badges ?? []).not.toContain('verified')
    expect(Number((data as any).total_sales ?? 0)).not.toBe(9999)
  })

  it('a restricted seller cannot un-restrict themselves (middleware trusts seller_status)', async () => {
    if (!ready) return
    await fx!.svc.from('profiles').update({ seller_status: 'restricted', seller_restriction_reason: 'test' }).eq('id', fx!.seller.id)
    const res = await fx!.seller.client.from('profiles')
      .update({ seller_status: 'active', seller_restriction_reason: null }).eq('id', fx!.seller.id).select('id')
    expectGuardRejection(res, 'profiles')
    const { data } = await fx!.svc.from('profiles').select('seller_status').eq('id', fx!.seller.id).single()
    expect((data as any).seller_status).toBe('restricted')
  })

  it('seller cannot write balances or Stripe identifiers', async () => {
    if (!ready) return
    const res = await fx!.seller.client.from('profiles')
      .update({ seller_balance: 1000000, stripe_connect_account_id: 'acct_evil' }).eq('id', fx!.seller.id).select('id')
    expectGuardRejection(res, 'profiles')
  })

  it('unprotected self-service columns remain editable', async () => {
    if (!ready) return
    const { error } = await fx!.seller.client.from('profiles').update({ bio: 'hello from guard test' }).eq('id', fx!.seller.id)
    expect(error).toBeNull()
  })

  it('POSITIVE: review inserts still work and update_seller_rating still writes the guarded counters', async () => {
    if (!ready) return
    const before = await fx!.svc.from('profiles').select('total_reviews').eq('id', fx!.seller.id).single()
    // (1) A BUYER can still leave a review — the guard does not break the insert.
    const { error } = await fx!.buyer.client.from('reviews').insert({
      order_id: fx!.completedOrderId, reviewer_id: fx!.buyer.id, seller_id: fx!.seller.id,
      listing_id: fx!.listingId, rating: 5, comment: 'guard test review (buyer)',
    })
    expect(error).toBeNull()
    // NOTE (pre-existing, not caused by the guard): update_seller_rating is
    // SECURITY INVOKER, so under the buyer's JWT its UPDATE profiles matches 0
    // rows (profiles RLS: users update only their own row) and the counter does
    // not move. Verified in psql on 2026-09-12; logged as AUTH-029.
    // (2) Where the trigger CAN write (service role, as the backend would), the
    // guarded counters update — proving the guard does not block the trigger.
    await fx!.svc.from('reviews').delete().eq('order_id', fx!.completedOrderId)
    const svcIns = await fx!.svc.from('reviews').insert({
      order_id: fx!.completedOrderId, reviewer_id: fx!.buyer.id, seller_id: fx!.seller.id,
      listing_id: fx!.listingId, rating: 5, comment: 'guard test review (service)',
    })
    expect(svcIns.error).toBeNull()
    const after = await fx!.svc.from('profiles').select('total_reviews,seller_rating').eq('id', fx!.seller.id).single()
    expect(Number((after.data as any).total_reviews)).toBe(Number((before.data as any).total_reviews ?? 0) + 1)
    expect(Number((after.data as any).seller_rating)).toBeGreaterThan(0)
  })
})
