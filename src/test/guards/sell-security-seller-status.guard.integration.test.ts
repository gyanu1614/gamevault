/**
 * /sell security — Part 2: seller status enforced after a listing exists
 * (audit ACC-01, ACC-04; BUG-16 gate).
 *
 *   ACC-01 · a restricted / banned seller's listing cannot become active by
 *            ANY path (raw update, the app's service-role write, even
 *            approve_listing), and a blocked seller cannot insert a row.
 *   ACC-04 · while the seller is still under pre-moderation, a content edit of
 *            an active listing goes back to pending_approval — in the trigger,
 *            so the wizard's service-role write is covered too.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, expectGuardRejection, establishedTier, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let gameId = ''
let pairId = ''

async function mkListing(extra: Record<string, unknown> = {}) {
  const { data, error } = await fx!.svc.from('listings').insert({
    seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
    title: fx!.ns.listingTitle(), description: 'seller-status guard', price: 1, quantity: 5, status: 'draft', ...extra,
  }).select('id').single()
  if (error) throw new Error(`listing insert: ${error.message}`)
  return (data as any).id as string
}
async function statusOf(id: string) {
  const { data } = await fx!.svc.from('listings').select('status').eq('id', id).single()
  return (data as any).status as string
}
async function setSellerStatus(status: 'active' | 'restricted' | 'banned') {
  const { error } = await fx!.svc.from('profiles').update({ seller_status: status }).eq('id', fx!.seller.id)
  if (error) throw new Error(`seller_status: ${error.message}`)
}

describe.skipIf(!hasEnv)('sell security Part 2 — seller status after a listing exists (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('sell_security_version')).error
    const { data: l } = await fx.svc.from('listings').select('game_id, game_category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; pairId = (l as any).game_category_id
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('the migration is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  describe('ACC-01 — a blocked seller cannot activate or create listings, whoever writes', () => {
    it('sell_access_kind follows seller_status', async () => {
      if (!ready) return
      const kind = async () => (await fx!.svc.rpc('sell_access_kind', { p_user: fx!.seller.id })).data
      expect(await kind()).toBe('seller')
      await setSellerStatus('restricted')
      expect(await kind()).toBe('seller_blocked')
      await setSellerStatus('active')
      // a JWT caller is pinned to itself: the buyer asking about the seller gets its own answer
      const { data: mine } = await fx!.buyer.client.rpc('sell_access_kind', { p_user: fx!.seller.id })
      expect(mine).toBe('none')
    })

    for (const blocked of ['restricted', 'banned'] as const) {
      it(`${blocked}: paused → active is refused for the service role (the app) and approve_listing; INSERT is refused`, async () => {
        if (!ready) return
        // promote past pre-moderation so only the seller-status rule can stop activation
        const { tier } = await establishedTier(fx!.svc)
        await fx!.svc.from('profiles').update({ seller_tier: tier }).eq('id', fx!.seller.id)
        const paused = await mkListing({ status: 'paused', approved_by: fx!.admin.id, approved_at: new Date().toISOString() })
        const pending = await mkListing({ status: 'pending_approval' })
        await setSellerStatus(blocked)
        try {
          const app = await fx!.svc.from('listings').update({ status: 'active' }).eq('id', paused).select('id')
          expectGuardRejection(app as any, 'listings')
          expect(await statusOf(paused)).toBe('paused')

          const { error: approveErr } = await fx!.admin.client.rpc('approve_listing', { listing_id: pending, admin_id: fx!.admin.id })
          expect(approveErr?.code).toBe('42501')
          expect(await statusOf(pending)).toBe('pending_approval')

          const ins = await fx!.svc.from('listings').insert({
            seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId,
            title: fx!.ns.listingTitle(), description: 'x', price: 1, quantity: 1, status: 'draft',
          }).select('id')
          expect(ins.error?.code).toBe('42501')

          // a non-activating edit (price on the paused row) still works: the seller's data is not frozen
          expect((await fx!.svc.from('listings').update({ price: 2 }).eq('id', paused)).error).toBeNull()
        } finally {
          await setSellerStatus('active')
        }
        // lifted: the same activation succeeds
        expect((await fx!.svc.from('listings').update({ status: 'active' }).eq('id', paused)).error).toBeNull()
        expect(await statusOf(paused)).toBe('active')
      })
    }

    it("a role='user' account's listing cannot be activated either (fixture buyer)", async () => {
      if (!ready) return
      const { data, error } = await fx!.svc.from('listings').insert({
        seller_id: fx!.buyer.id, game_id: gameId, game_category_id: pairId,
        title: fx!.ns.listingTitle(), description: 'x', price: 1, quantity: 1, status: 'pending_approval',
      }).select('id').single()
      expect(error).toBeNull()
      const { error: approveErr } = await fx!.admin.client.rpc('approve_listing', { listing_id: (data as any).id, admin_id: fx!.admin.id })
      expect(approveErr?.code).toBe('42501')
    })
  })

  describe('ACC-04 — content edits under pre-moderation go back to review', () => {
    it('an entry-tier seller editing the title of an approved active listing lands in pending_approval; price/stock edits do not', async () => {
      if (!ready) return
      const { entry } = await establishedTier(fx!.svc)
      await fx!.svc.from('profiles').update({ seller_tier: entry }).eq('id', fx!.seller.id)
      // earlier cases left approved rows behind; pre-moderation counts them, so park them
      await fx!.svc.from('listings').update({ status: 'paused', approved_at: null, approved_by: null }).eq('seller_id', fx!.seller.id)

      const id = await mkListing({ status: 'active', approved_by: fx!.admin.id, approved_at: new Date().toISOString() })
      const needs = (await fx!.svc.rpc('check_seller_needs_moderation', { seller_id: fx!.seller.id })).data
      expect(needs).toBe(true)
      expect((await fx!.svc.from('listings').update({ price: 3, quantity: 9 }).eq('id', id)).error).toBeNull()
      expect(await statusOf(id)).toBe('active')
      expect((await fx!.svc.from('listings').update({ title: fx!.ns.listingTitle() + ' v2' }).eq('id', id)).error).toBeNull()
      expect(await statusOf(id)).toBe('pending_approval')
      // review brings it back
      const { error } = await fx!.admin.client.rpc('approve_listing', { listing_id: id, admin_id: fx!.admin.id })
      expect(error).toBeNull()
      expect(await statusOf(id)).toBe('active')
    })

    it('an established seller (no pre-moderation) keeps the listing active on a content edit', async () => {
      if (!ready) return
      const { tier } = await establishedTier(fx!.svc)
      await fx!.svc.from('profiles').update({ seller_tier: tier }).eq('id', fx!.seller.id)
      const id = await mkListing({ status: 'active', approved_by: fx!.admin.id, approved_at: new Date().toISOString() })
      expect((await fx!.svc.from('listings').update({ description: 'edited' }).eq('id', id)).error).toBeNull()
      expect(await statusOf(id)).toBe('active')
    })
  })
})
