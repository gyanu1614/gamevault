/**
 * Open seller signup (2026-10-08) — list first, verify at withdrawal.
 *
 *   · seller_onboarding + seller_agreements exist, RLS on, closed to the anon
 *     and authenticated roles (server actions read/write them as the service
 *     role, scoped to the session user);
 *   · the private bucket seller-signatures exists and is not public;
 *   · seller_onboarding_complete() refuses until details, store and a signed
 *     agreement for the CURRENT version are all present, then flips the
 *     profile to an unverified, active seller on the entry rank with a unique
 *     shop slug and the founding programme — and is idempotent;
 *   · an unverified seller's listing above UNVERIFIED_REVIEW_PRICE_USD is held
 *     for review by the DB trigger even when the tier would auto-approve; a
 *     verified seller's is not; the TS and SQL thresholds are equal;
 *   · the new seller cannot withdraw (kyc_required) and may use the sell surface.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'
import { UNVERIFIED_REVIEW_PRICE_USD } from '@/lib/fees'
import { FOUNDING_SPOT_CAP } from '@/lib/config/founding-seller'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const AGREEMENT_VERSION = 'v1.1-test'
const tag = Math.random().toString(36).slice(2, 8)

let fx: Fixture | null = null
let ready = false
let gameId = ''
let catId = ''

async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}
async function complete(userId: string) {
  return rpc('seller_onboarding_complete', { p_user: userId, p_agreement_version: AGREEMENT_VERSION })
}
async function profile(userId: string) {
  const { data } = await fx!.svc.from('profiles')
    .select('role, seller_status, seller_tier, is_verified, shop_name, shop_slug, founding_seller, founding_since').eq('id', userId).single()
  return data as any
}
async function insertListing(sellerId: string, title: string, extra: Record<string, unknown>) {
  const { error } = await fx!.svc.from('listings').insert({
    seller_id: sellerId, game_id: gameId, category_id: catId, title, description: 'guard test', price: 1, quantity: 1, ...extra,
  } as any)
  if (error) throw new Error(`insert listing: ${error.message}`)
  const { data } = await fx!.svc.from('listings').select('status').eq('title', title).maybeSingle()
  return (data as any)?.status as string
}

describe.skipIf(!hasEnv)('open seller signup — onboarding tables, completion RPC, price review rule (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await (fx.svc.rpc as any)('open_seller_signup_version')).error
    const { data: l } = await fx.svc.from('listings').select('game_id, category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; catId = (l as any).category_id
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('listings').delete().like('title', `OSS-${tag}%`)
    await fx.cleanup()
  }, 60_000)

  it('the migration is applied to the target DB', () => {
    expect(ready, 'apply the open_seller_signup migration first').toBe(true)
  })

  it('both tables are closed to the anon and authenticated roles', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    for (const table of ['seller_onboarding', 'seller_agreements']) {
      const a = await anon.from(table).select('*').limit(1)
      expect(a.error, `anon read ${table}`).not.toBeNull()
      const u = await fx!.buyer.client.from(table).select('*').limit(1)
      expect(u.error, `authenticated read ${table}`).not.toBeNull()
      const w = await fx!.buyer.client.from(table).insert({ user_id: fx!.buyer.id } as any)
      expect(w.error, `authenticated insert ${table}`).not.toBeNull()
    }
  })

  it('seller-signatures is a private bucket', async () => {
    const { data } = await fx!.svc.rpc('storage_bucket_posture' as any, { p_bucket: 'seller-signatures' })
    expect((data as any)?.exists).toBe(true)
    expect((data as any)?.is_public).toBe(false)
  })

  it('the TS and SQL review thresholds are the same number', async () => {
    const v = await rpc<number>('unverified_review_price_usd', {})
    expect(Number(v)).toBe(UNVERIFIED_REVIEW_PRICE_USD)
    const cap = await rpc<number>('founding_spot_cap', {})
    expect(Number(cap)).toBe(FOUNDING_SPOT_CAP)
  })

  it('completion refuses step by step, then makes an unverified active seller on the entry rank (idempotent)', async () => {
    const uid = fx!.buyer.id
    expect(await complete(uid)).toMatchObject({ completed: false, reason: 'no_onboarding' })

    await fx!.svc.from('seller_onboarding').insert({ user_id: uid, source: 'guard-test' } as any)
    expect(await complete(uid)).toMatchObject({ completed: false, reason: 'details_incomplete' })

    await fx!.svc.from('seller_onboarding').update({
      country: 'GB', sells: [{ game: 'adopt-me', categories: ['items'] }], is_adult_confirmed_at: new Date().toISOString(),
    } as any).eq('user_id', uid)
    expect(await complete(uid)).toMatchObject({ completed: false, reason: 'store_incomplete' })

    const storeName = `Guard Store ${tag}`
    await fx!.svc.from('seller_onboarding').update({ store_name: storeName } as any).eq('user_id', uid)
    expect(await complete(uid)).toMatchObject({ completed: false, reason: 'agreement_missing' })

    // an OLDER version does not count
    await fx!.svc.from('seller_agreements').insert({
      user_id: uid, agreement_version: 'v0.9-test', agreement_sha256: 'a'.repeat(64), typed_name: 'Guard Tester',
      signature_path: `${uid}/old.png`, ip: '203.0.113.9', user_agent: 'vitest',
    } as any)
    expect(await complete(uid)).toMatchObject({ completed: false, reason: 'agreement_missing' })

    const { error: agErr } = await fx!.svc.from('seller_agreements').insert({
      user_id: uid, agreement_version: AGREEMENT_VERSION, agreement_sha256: 'b'.repeat(64), typed_name: 'Guard Tester',
      signature_path: `${uid}/sig.png`, ip: '203.0.113.9', user_agent: 'vitest',
    } as any)
    expect(agErr).toBeNull()

    const before = await profile(uid)
    expect(before.role).not.toBe('seller')

    const r = await complete(uid)
    expect(r).toMatchObject({ completed: true })
    expect(r.shop_slug).toMatch(/^guard-store-/)

    const { data: entry } = await fx!.svc.from('seller_tier_config').select('tier').order('sort_order', { ascending: true }).limit(1).single()
    const after = await profile(uid)
    expect(after).toMatchObject({
      role: 'seller', seller_status: 'active', seller_tier: (entry as any).tier, is_verified: false,
      shop_name: storeName, shop_slug: r.shop_slug, founding_seller: true,
    })
    expect(after.founding_since).toBeTruthy()

    const { data: ob } = await fx!.svc.from('seller_onboarding').select('completed_at').eq('user_id', uid).single()
    expect((ob as any).completed_at).toBeTruthy()

    // idempotent — a second call changes nothing and reports already
    const again = await complete(uid)
    expect(again).toMatchObject({ completed: true, already: true })
    expect((await profile(uid)).shop_slug).toBe(r.shop_slug)

    // the gates agree: may sell, may not withdraw
    expect(await rpc('sell_access_kind', { p_user: uid })).toBe('seller')
    const gate = await rpc('seller_withdrawal_gate', { p_seller_id: uid })
    expect(gate).toMatchObject({ eligible: false, reason: 'kyc_required' })
  })

  it('a taken store name is refused (case-insensitive)', async () => {
    const uid = fx!.admin.id // any non-seller fixture user
    const taken = (await profile(fx!.buyer.id)).shop_name as string
    await fx!.svc.from('seller_onboarding').insert({
      user_id: uid, source: 'guard-test', country: 'US', sells: [{ game: 'roblox', categories: ['currency'] }],
      is_adult_confirmed_at: new Date().toISOString(), store_name: taken.toUpperCase(),
    } as any)
    await fx!.svc.from('seller_agreements').insert({
      user_id: uid, agreement_version: AGREEMENT_VERSION, agreement_sha256: 'c'.repeat(64), typed_name: 'Guard Admin',
      signature_path: `${uid}/sig.png`,
    } as any)
    expect(await complete(uid)).toMatchObject({ completed: false, reason: 'store_name_taken' })
    await fx!.svc.from('seller_onboarding').delete().eq('user_id', uid)
    await fx!.svc.from('seller_agreements').delete().eq('user_id', uid)
  })

  it('approved rows (security review): a price raise over the line voids the approval and holds the row on every seller path; unpause keeps it; admin approve goes live', async () => {
    await promoteToEstablishedSeller(fx!.svc, fx!.seller.id)
    await fx!.svc.from('profiles').update({ is_verified: false }).eq('id', fx!.seller.id)
    const mk = async (name: string, price: number) => {
      const title = `OSS-${tag} ${name}`
      const status = await insertListing(fx!.seller.id, title, { status: 'active', price })
      const { data } = await fx!.svc.from('listings').select('id').eq('title', title).single()
      return { id: (data as any).id as string, status }
    }
    const row = async (id: string) => (await fx!.svc.from('listings').select('status, approved_by, price').eq('id', id).single()).data as any
    const approve = (id: string) => rpc('approve_listing', { listing_id: id, admin_id: fx!.admin.id })
    const upd = async (id: string | string[], patch: Record<string, unknown>) => {
      const q = fx!.svc.from('listings').update(patch as any)
      const { error } = Array.isArray(id) ? await q.in('id', id) : await q.eq('id', id)
      if (error) throw new Error(`update: ${error.message}`)
    }
    try {
      // admin approve of a $150 listing from an unverified seller goes LIVE (moderation RPC is exempt)
      const a = await mk('A', 150)
      expect(a.status).toBe('pending_approval')
      await approve(a.id)
      expect(await row(a.id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })

      // inline price edit (offers table) on the approved row → review, approval voided
      await upd(a.id, { price: 5000 })
      expect(await row(a.id)).toMatchObject({ status: 'pending_approval', approved_by: null })

      // bulk edit: two approved rows re-priced in one statement → both held
      const b1 = await mk('B1', 150); const b2 = await mk('B2', 150)
      await approve(b1.id); await approve(b2.id)
      await upd([b1.id, b2.id], { price: 5000 })
      expect((await row(b1.id)).status).toBe('pending_approval')
      expect((await row(b2.id)).status).toBe('pending_approval')

      // draft variant: re-price while draft (approval voided, stays draft), then activate → held
      const c = await mk('C', 150); await approve(c.id)
      await upd(c.id, { status: 'draft', price: 5000 })
      expect(await row(c.id)).toMatchObject({ status: 'draft', approved_by: null })
      await upd(c.id, { status: 'active' })
      expect((await row(c.id)).status).toBe('pending_approval')

      // wizard-shaped edit: price + status in one statement → held
      const d = await mk('D', 150); await approve(d.id)
      await upd(d.id, { price: 5000, status: 'active' })
      expect((await row(d.id)).status).toBe('pending_approval')

      // unpause / restock WITHOUT a price change keeps the admin's approval
      const e = await mk('E', 150); await approve(e.id)
      await upd(e.id, { status: 'paused' })
      await upd(e.id, { status: 'active' })
      expect(await row(e.id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })
      await upd(e.id, { status: 'sold' })
      await upd(e.id, { status: 'active', quantity: 5 })
      expect(await row(e.id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })

      // a price change that stays at or under the line keeps the approval too
      const g = await mk('G', 150); await approve(g.id)
      await upd(g.id, { price: 90 })
      expect(await row(g.id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })
    } finally {
      await fx!.svc.from('profiles').update({ is_verified: true }).eq('id', fx!.seller.id)
    }
    // a verified seller re-pricing an approved row over the line is untouched
    const f = await mk('F', 150)
    expect(f.status).toBe('active')
    await upd(f.id, { price: 5000 })
    expect((await row(f.id)).status).toBe('active')
  })

  it('an unverified seller’s listing above the review price is held; at or below it goes live; a verified seller’s is not held', async () => {
    // Past the entry rank so pre-moderation does not apply — only the price rule can hold it.
    await promoteToEstablishedSeller(fx!.svc, fx!.seller.id)
    await fx!.svc.from('profiles').update({ is_verified: false }).eq('id', fx!.seller.id)
    try {
      expect(await insertListing(fx!.seller.id, `OSS-${tag} over`, { status: 'active', price: UNVERIFIED_REVIEW_PRICE_USD + 0.01 })).toBe('pending_approval')
      expect(await insertListing(fx!.seller.id, `OSS-${tag} at`, { status: 'active', price: UNVERIFIED_REVIEW_PRICE_USD })).toBe('active')
      expect(await insertListing(fx!.seller.id, `OSS-${tag} draft`, { status: 'draft', price: 999 })).toBe('draft')
      // raising a live listing's price over the line sends it back to review
      await fx!.svc.from('listings').update({ price: 500 } as any).eq('title', `OSS-${tag} at`)
      const { data: raised } = await fx!.svc.from('listings').select('status').eq('title', `OSS-${tag} at`).single()
      expect((raised as any).status).toBe('pending_approval')
    } finally {
      await fx!.svc.from('profiles').update({ is_verified: true }).eq('id', fx!.seller.id)
    }
    expect(await insertListing(fx!.seller.id, `OSS-${tag} verified`, { status: 'active', price: 999 })).toBe('active')
  })
})
