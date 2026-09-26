/**
 * /sell security — Part 1: one listing validator + DB guard
 * (audit ACC-03, ACC-05, ACC-06, ACC-11; BUG-02 / BUG-13 server halves).
 *
 * What the database now guarantees, whoever writes:
 *   ACC-03 · a JWT caller cannot UPDATE listings at all (grant revoked); a
 *            listing cannot be moved to another game or to a disabled pair;
 *            delivery_method is manual|instant; moderated-out → active is
 *            review-only even for the service role.
 *   ACC-06 · price > 0 (CHECK), for every caller.
 *   ACC-05 · min_quantity <= quantity unless unlimited (sold-out rows exempt).
 *   ACC-11 · a JWT insert can only be born draft / pending_approval.
 * The user-facing half (config floor/ceiling, bundle ids, rounding) lives in
 * src/lib/listings/validate.ts and is unit-tested there.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, expectGuardRejection, promoteToEstablishedSeller, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let gameId = ''
let pairId = ''

async function applied(): Promise<boolean> {
  const { error } = await fx!.svc.rpc('sell_security_version')
  return !error
}

async function mkListing(extra: Record<string, unknown> = {}) {
  const { data, error } = await fx!.svc.from('listings').insert({
    seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
    title: fx!.ns.listingTitle(), description: 'sell-security guard', price: 1, quantity: 5, status: 'draft', ...extra,
  }).select('id').single()
  if (error) throw new Error(`listing insert: ${error.message}`)
  return (data as any).id as string
}
async function row(id: string) {
  const { data } = await fx!.svc.from('listings').select('status, price, min_quantity, quantity, game_id, game_category_id, delivery_method').eq('id', id).single()
  return data as any
}
/** A second, DISABLED pair under the same game (cleaned up in afterAll). */
let disabledPairId = ''
async function mkDisabledPair() {
  const { data: gc } = await fx!.svc.from('global_categories').select('id').eq('slug', 'currency').maybeSingle()
  const { data, error } = await fx!.svc.from('game_categories')
    .insert({ game_id: gameId, global_category_id: (gc as any).id, is_enabled: false, slug: `sell-sec-off-${fx!.ns.tag}`, name: 'Off', type: 'currency' })
    .select('id').single()
  if (error) throw new Error(`disabled pair insert: ${error.message}`)
  return (data as any).id as string
}

describe.skipIf(!hasEnv)('sell security Part 1 — listing validator + DB guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await applied()
    const { data: l } = await fx.svc.from('listings').select('game_id, game_category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; pairId = (l as any).game_category_id
    disabledPairId = await mkDisabledPair()
    // Past the entry tier: check_listing_moderation no longer coerces
    // → active into pending_approval, so only the guard rules below can.
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
  }, 60_000)
  afterAll(async () => {
    if (disabledPairId) {
      const { data: pair } = await fx!.svc.from('game_categories').select('legacy_category_id').eq('id', disabledPairId).maybeSingle()
      await fx!.svc.from('game_categories').delete().eq('id', disabledPairId)
      if ((pair as any)?.legacy_category_id) await fx!.svc.from('categories').delete().eq('id', (pair as any).legacy_category_id)
    }
    await fx?.cleanup()
  }, 60_000)

  it('20260925204757_sell_security_listing_guard.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  describe('ACC-06 — no $0 listing, for any caller', () => {
    it('INSERT price = 0 and UPDATE price = 0 both fail the CHECK', async () => {
      if (!ready) return
      const ins = await fx!.svc.from('listings').insert({
        seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
        title: fx!.ns.listingTitle(), description: 'x', price: 0, quantity: 1, status: 'draft',
      }).select('id')
      expect(ins.error?.code).toBe('23514')
      const id = await mkListing()
      const upd = await fx!.svc.from('listings').update({ price: 0 }).eq('id', id).select('id')
      expect(upd.error?.code).toBe('23514')
      expect(Number((await row(id)).price)).toBe(1)
    })
  })

  describe('ACC-05 — a minimum order above the stock is refused, for any caller', () => {
    it('INSERT min > quantity fails; raising the minimum above stock fails; a sold-out row is exempt', async () => {
      if (!ready) return
      const ins = await fx!.svc.from('listings').insert({
        seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
        title: fx!.ns.listingTitle(), description: 'x', price: 1, quantity: 5, min_quantity: 10, status: 'draft',
      }).select('id')
      expect(ins.error?.code).toBe('23514')
      const id = await mkListing({ quantity: 5, min_quantity: 2 })
      const upd = await fx!.svc.from('listings').update({ min_quantity: 9 }).eq('id', id).select('id')
      expect(upd.error?.code).toBe('23514')
      expect((await row(id)).min_quantity).toBe(2)
      // a trusted stock decrement below the minimum (an order completing) is allowed
      expect((await fx!.svc.from('listings').update({ quantity: 1 }).eq('id', id)).error).toBeNull()
      // sold out: quantity 0 with any minimum is fine
      expect((await fx!.svc.from('listings').update({ quantity: 0 }).eq('id', id)).error).toBeNull()
      // unlimited stock never conflicts
      const unl = await mkListing({ quantity: 1, min_quantity: 100, is_unlimited: true })
      expect((await row(unl)).min_quantity).toBe(100)
    })
  })

  describe('ACC-11 — a crafted status on a direct insert is refused', () => {
    it("a seller's own PostgREST insert can be born draft or pending_approval only", async () => {
      if (!ready) return
      // the fixture seller has no role yet: give it the seller role so the INSERT policy admits it
      await fx!.svc.from('profiles').update({ role: 'seller' }).eq('id', fx!.seller.id)
      const base = {
        seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
        description: 'x', price: 1, quantity: 1,
      }
      for (const status of ['paused', 'sold', 'suspended', 'archived', 'rejected', 'changes_requested']) {
        const res = await fx!.seller.client.from('listings').insert({ ...base, title: fx!.ns.listingTitle(), status }).select('id')
        expect(res.error?.code, status).toBe('42501')
      }
      const draft = await fx!.seller.client.from('listings').insert({ ...base, title: fx!.ns.listingTitle(), status: 'draft' }).select('id, status').single()
      expect(draft.error).toBeNull()
      expect((draft.data as any).status).toBe('draft')
      // AUTH-031: 'active' is coerced into review, never refused
      const active = await fx!.seller.client.from('listings').insert({ ...base, title: fx!.ns.listingTitle(), status: 'active' }).select('id, status').single()
      expect(active.error).toBeNull()
      expect((active.data as any).status).toBe('pending_approval')
    })
  })

  describe('ACC-03 — seller edits cannot bypass validation', () => {
    it('a seller cannot UPDATE their own listing through PostgREST at all — not even the price', async () => {
      if (!ready) return
      const id = await mkListing()
      const res = await fx!.seller.client.from('listings').update({ price: 2 }).eq('id', id).select('id')
      expect(res.error?.code).toBe('42501')
      expect((await row(id)).price).toBe(1)
    })

    it('an admin session cannot UPDATE listings directly either (admin writes are service-role actions)', async () => {
      if (!ready) return
      const id = await mkListing()
      const res = await fx!.admin.client.from('listings').update({ price: 2 }).eq('id', id).select('id')
      expect(res.error?.code).toBe('42501')
    })

    it('service role (the app) cannot move a listing to a DISABLED pair or to another game', async () => {
      if (!ready) return
      const id = await mkListing()
      const off = await fx!.svc.from('listings').update({ game_category_id: disabledPairId }).eq('id', id).select('id')
      expect(off.error?.code).toBe('23514')
      expect(off.error?.message).toMatch(/not enabled/)
      const { data: otherGame } = await fx!.svc.from('games').select('id').neq('id', gameId).limit(1).maybeSingle()
      if ((otherGame as any)?.id) {
        const moved = await fx!.svc.from('listings').update({ game_id: (otherGame as any).id }).eq('id', id).select('id')
        expect(moved.error?.code).toBe('23514')
      }
      const r = await row(id)
      expect(r.game_id).toBe(gameId)
      expect(r.game_category_id).toBe(pairId)
    })

    it('a listing cannot be INSERTED into a disabled pair, by any caller', async () => {
      if (!ready) return
      const res = await fx!.svc.from('listings').insert({
        seller_id: fx!.seller.id, game_id: gameId, game_category_id: disabledPairId,
        title: fx!.ns.listingTitle(), description: 'x', price: 1, quantity: 1, status: 'draft',
      }).select('id')
      expect(res.error?.code).toBe('23514')
    })

    it('delivery_method outside manual|instant is rejected for every caller', async () => {
      if (!ready) return
      const res = await fx!.svc.from('listings').insert({
        seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
        title: fx!.ns.listingTitle(), description: 'x', price: 1, quantity: 1, status: 'draft', delivery_method: 'pigeon',
      }).select('id')
      expect(res.error?.code).toBe('23514')
      const id = await mkListing()
      const upd = await fx!.svc.from('listings').update({ delivery_method: 'telepathy' }).eq('id', id).select('id')
      expect(upd.error?.code).toBe('23514')
    })

    it('AUTH-034 now binds the service role: rejected/changes_requested/pending → active only via approve_listing', async () => {
      if (!ready) return
      for (const from of ['rejected', 'changes_requested', 'pending_approval']) {
        const id = await mkListing({ status: from, ...(from === 'rejected' ? { rejected_at: new Date().toISOString(), rejection_reason: 'no' } : {}) })
        const res = await fx!.svc.from('listings').update({ status: 'active' }).eq('id', id).select('id')
        expectGuardRejection(res as any, 'listings')
        expect((await row(id)).status).toBe(from)
      }
      const pending = await mkListing({ status: 'pending_approval' })
      const { error } = await fx!.admin.client.rpc('approve_listing', { listing_id: pending, admin_id: fx!.admin.id })
      expect(error).toBeNull()
      expect((await row(pending)).status).toBe('active')
    })

    it('POSITIVE: the app (service role) can still pause / unpause, restock a sold listing and pull a rejected one to draft', async () => {
      if (!ready) return
      const active = await mkListing({ status: 'active', approved_by: fx!.admin.id, approved_at: new Date().toISOString() })
      expect((await fx!.svc.from('listings').update({ status: 'paused' }).eq('id', active)).error).toBeNull()
      expect((await fx!.svc.from('listings').update({ status: 'active' }).eq('id', active)).error).toBeNull()
      const sold = await mkListing({ status: 'sold', approved_by: fx!.admin.id, approved_at: new Date().toISOString(), quantity: 0 })
      expect((await fx!.svc.from('listings').update({ status: 'active', quantity: 3 }).eq('id', sold)).error).toBeNull()
      const rejected = await mkListing({ status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: 'no' })
      expect((await fx!.svc.from('listings').update({ status: 'draft' }).eq('id', rejected)).error).toBeNull()
    })
  })
})
