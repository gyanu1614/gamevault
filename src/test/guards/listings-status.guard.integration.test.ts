/**
 * AUTH-034 — a seller cannot self-reactivate a moderated-out listing.
 * Exploit: after reject_listing (approved_by NULL, status 'rejected') the
 * seller UPDATEs status='active'; check_listing_moderation only pre-moderates
 * entry-tier sellers, so for anyone else the rejected listing was live again
 * (reproduced 2026-09-12). Same for 'changes_requested' and 'pending_approval'.
 * Positive: paused ↔ active, sold → active (restock), rejected → draft, and the
 * guarded approve_listing RPC still work.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, expectGuardRejection, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let gameId = ''
let catId = ''

async function mkListing(status: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await fx!.svc.from('listings').insert({
    seller_id: fx!.seller.id, game_id: gameId, category_id: catId, title: `AUTH-034 ${status} ${Math.random().toString(36).slice(2, 6)}`,
    description: 'guard test', price: 1, quantity: 1, status, ...extra,
  }).select('id').single()
  if (error) throw new Error(`listing insert: ${error.message}`)
  return (data as any).id as string
}
async function statusOf(id: string) {
  const { data } = await fx!.svc.from('listings').select('status').eq('id', id).single()
  return (data as any).status as string
}

describe.skipIf(!hasEnv)('AUTH-034 — listings status transition guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
    const { data: l } = await fx.svc.from('listings').select('game_id, category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; catId = (l as any).category_id
    // past the entry tier: pre-moderation does not apply, only the guard can stop it
    await fx.svc.from('profiles').update({ role: 'seller', seller_tier: 'ruby' }).eq('id', fx.seller.id)
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() })

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  for (const from of ['rejected', 'changes_requested', 'pending_approval']) {
    it(`the seller cannot flip ${from} → active`, async () => {
      const id = await mkListing(from, from === 'rejected' ? { rejected_at: new Date().toISOString(), rejection_reason: 'no' } : {})
      const res = await fx!.seller.client.from('listings').update({ status: 'active' }).eq('id', id).select('id')
      expectGuardRejection(res as any, 'listings')
      expect(await statusOf(id)).toBe(from)
    })
  }

  it('the seller can still pause/unpause, restock a sold listing, and pull a rejected one back to draft', async () => {
    const active = await mkListing('active', { approved_by: fx!.admin.id, approved_at: new Date().toISOString() })
    expect((await fx!.seller.client.from('listings').update({ status: 'paused' }).eq('id', active)).error).toBeNull()
    expect((await fx!.seller.client.from('listings').update({ status: 'active' }).eq('id', active)).error).toBeNull()
    expect(await statusOf(active)).toBe('active')

    const sold = await mkListing('sold', { approved_by: fx!.admin.id, approved_at: new Date().toISOString(), quantity: 0 })
    expect((await fx!.seller.client.from('listings').update({ status: 'active', quantity: 3 }).eq('id', sold)).error).toBeNull()
    expect(await statusOf(sold)).toBe('active')

    const rejected = await mkListing('rejected', { rejected_at: new Date().toISOString(), rejection_reason: 'no' })
    expect((await fx!.seller.client.from('listings').update({ status: 'draft' }).eq('id', rejected)).error).toBeNull()
    expect(await statusOf(rejected)).toBe('draft')
  })

  it('the admin approve_listing RPC still activates a pending listing', async () => {
    const pending = await mkListing('pending_approval')
    const { error } = await fx!.admin.client.rpc('approve_listing', { listing_id: pending, admin_id: fx!.admin.id })
    expect(error).toBeNull()
    expect(await statusOf(pending)).toBe('active')
  })
})
