/**
 * AUTH-006 — listings moderation columns are guarded.
 * Exploit: seller sets approved_by = self to short-circuit check_listing_moderation.
 * Positive: an admin approves through approve_listing (flag path) and it lands active.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, guardsApplied, makeFixture, expectGuardRejection, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('AUTH-006 — listings column guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await guardsApplied(fx.svc)
    if (!ready) console.warn('[listings guard] skipping — 20260911120000_auth_p0_column_guards.sql not applied')
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() })

  it('seller cannot self-approve (approved_by = self, status = active)', async () => {
    if (!ready) return
    const res = await fx!.seller.client.from('listings')
      .update({ approved_by: fx!.seller.id, approved_at: new Date().toISOString(), status: 'active' })
      .eq('id', fx!.listingId).select('id')
    expectGuardRejection(res, 'listings')
    const { data } = await fx!.svc.from('listings').select('status,approved_by').eq('id', fx!.listingId).single()
    expect((data as any).status).toBe('pending_approval')
    expect((data as any).approved_by).toBeNull()
  })

  it('seller setting status=active alone still lands in pending_approval (verified live 3b)', async () => {
    if (!ready) return
    const { error } = await fx!.seller.client.from('listings').update({ status: 'active' }).eq('id', fx!.listingId)
    expect(error).toBeNull()
    const { data } = await fx!.svc.from('listings').select('status').eq('id', fx!.listingId).single()
    expect((data as any).status).toBe('pending_approval')
  })

  it('seller cannot clear moderation_notes or move the listing to another seller', async () => {
    if (!ready) return
    await fx!.svc.from('listings').update({ moderation_notes: 'needs fix' }).eq('id', fx!.listingId)
    const res = await fx!.seller.client.from('listings')
      .update({ moderation_notes: null, seller_id: fx!.buyer.id }).eq('id', fx!.listingId).select('id')
    expectGuardRejection(res, 'listings')
  })

  it('seller can still edit their own price (unprotected column)', async () => {
    if (!ready) return
    const { error } = await fx!.seller.client.from('listings').update({ price: 2 }).eq('id', fx!.listingId)
    expect(error).toBeNull()
  })

  it('POSITIVE: admin approves via approve_listing and it goes active (flag path)', async () => {
    if (!ready) return
    const { error } = await fx!.admin.client.rpc('approve_listing', { listing_id: fx!.listingId, admin_id: fx!.admin.id })
    expect(error).toBeNull()
    const { data } = await fx!.svc.from('listings').select('status,approved_by').eq('id', fx!.listingId).single()
    expect((data as any).status).toBe('active')
    expect((data as any).approved_by).toBe(fx!.admin.id)
  })
})
