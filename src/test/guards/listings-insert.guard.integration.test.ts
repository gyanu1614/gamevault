/**
 * AUTH-009 — only sellers publish; the publish-policy RPC is self-scoped.
 * Exploits: (a) a plain user INSERTs a listings row through PostgREST (the bare
 * `uid = seller_id` policy made the role-checking policy dead); (b) the anon
 * key calls get_seller_publish_policy; (c) a user reads another user's policy
 * by passing their uuid. Positive: a role='seller' profile still inserts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, p1GuardsApplied, makeFixture, expectGuardRejection, promoteToEstablishedSeller, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let gameId = ''
let catId = ''
let sellerTier = ''

describe.skipIf(!hasEnv)('AUTH-009 — listings INSERT + publish policy RPC (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
    const { data: l } = await fx.svc.from('listings').select('game_id, category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; catId = (l as any).category_id
    // Fixture users are role='user'. Promote the seller (service role; guarded columns) to a
    // tier read from the LIVE config so the RPC scoping test can tell the two apart.
    sellerTier = (await promoteToEstablishedSeller(fx.svc, fx.seller.id)).tier
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  const row = (sellerId: string, tag: string) => ({
    seller_id: sellerId, game_id: gameId, category_id: catId, title: `AUTH-009 ${tag}`,
    description: 'guard test', price: 1, quantity: 1, status: 'draft',
  })

  it("a role='user' account cannot INSERT a listing", async () => {
    const res = await fx!.buyer.client.from('listings').insert(row(fx!.buyer.id, 'buyer')).select('id')
    expectGuardRejection(res as any, 'listings')
    const { data } = await fx!.svc.from('listings').select('id').eq('seller_id', fx!.buyer.id)
    expect(data ?? []).toHaveLength(0)
  })

  it("a role='seller' account still inserts its own listing", async () => {
    const res = await fx!.seller.client.from('listings').insert(row(fx!.seller.id, 'seller')).select('id')
    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(1)
  })

  it('the anon key cannot call get_seller_publish_policy', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { error } = await anon.rpc('get_seller_publish_policy', { p_user_id: fx!.seller.id })
    expect(error, 'anon must be refused').not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it("a user asking for someone else's publish policy gets their OWN", async () => {
    const { data, error } = await fx!.buyer.client.rpc('get_seller_publish_policy', { p_user_id: fx!.seller.id })
    expect(error).toBeNull()
    expect((data as any).tier).not.toBe(sellerTier) // seller is on the established tier; buyer on the default
  })

  it('an unknown / tier-less user falls back to the entry tier of the LIVE config, not a hard-coded name', async () => {
    const { data: cfg } = await fx!.svc.from('seller_tier_config').select('tier, sort_order').order('sort_order', { ascending: true }).limit(1)
    const entry = (cfg as any[])[0].tier
    const { data, error } = await fx!.svc.rpc('get_seller_publish_policy', { p_user_id: '00000000-0000-0000-0000-000000000000' })
    expect(error).toBeNull()
    expect((data as any).tier).toBe(entry)
    expect((data as any).listing_limit === null || typeof (data as any).listing_limit === 'number').toBe(true)
  })

  it('the service role can still read any user\'s policy (admin/cron paths)', async () => {
    const { data, error } = await fx!.svc.rpc('get_seller_publish_policy', { p_user_id: fx!.seller.id })
    expect(error).toBeNull()
    expect((data as any).tier).toBe(sellerTier)
  })
})
