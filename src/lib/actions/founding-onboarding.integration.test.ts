/**
 * Open seller signup — the server actions end to end against the local stack
 * (migration 20261008023032). The cookie client is the fixture buyer's
 * signed-in client; headers() is faked so the agreement records an IP + UA.
 *
 *   state (buyer, nothing saved) → details (bad, then good) → store name check
 *   → store saved → agreement (bad PNG, then good) → the account is an
 *   unverified seller: profile flipped, agreement row + signature object,
 *   stage 5, withdrawal gate says kyc_required.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from '@/test/guards/throwaway'

let fx: Fixture | null = null
const tag = Math.random().toString(36).slice(2, 8)
const FAKE_IP = '203.0.113.77'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!fx) throw new Error('fixture not ready')
    return fx.buyer.client
  },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': `${FAKE_IP}, 10.0.0.1`, 'user-agent': 'vitest/open-seller-signup' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
// The per-IP budget (5/min on 'contact') is exercised by rate-limit.test.ts; this
// test makes more than five writes from one fake IP on purpose.
vi.mock('@/lib/security/rate-limit', () => ({ rateLimitAction: async () => null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const pngDataUrl = (bytes = 2048) =>
  `data:image/png;base64,${Buffer.concat([PNG_HEAD, Buffer.alloc(bytes - PNG_HEAD.length, 9)]).toString('base64')}`

describe.skipIf(!hasEnv)('founding onboarding actions (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const { data: objs } = await fx.svc.storage.from('seller-signatures').list(fx.buyer.id)
    if (objs?.length) await fx.svc.storage.from('seller-signatures').remove(objs.map((o) => `${fx!.buyer.id}/${o.name}`))
    await fx.cleanup()
  }, 60_000)

  it('walks a buyer through all four steps and ends as an unverified seller', async () => {
    const a = await import('@/lib/actions/founding-onboarding')

    // 1. signed in, nothing saved → step 2
    let state = await a.getFoundingFlowState()
    expect(state.signedIn).toBe(true)
    expect(state.isSeller).toBe(false)
    expect(state.stage).toBe(2)
    expect(state.agreementVersion).toMatch(/^v\d/)

    // 2. details: refused on bad input, saved on good
    const bad = await a.saveFoundingDetails({ country: 'ZZ', sells: [{ game: 'adopt-me', categories: ['items'] }], isAdult: true })
    expect(bad.success).toBe(false)
    const noAge = await a.saveFoundingDetails({ country: 'GB', sells: [{ game: 'adopt-me', categories: ['items'] }], isAdult: false as unknown as true })
    expect(noAge.success).toBe(false)
    const ok = await a.saveFoundingDetails({ country: 'gb', sells: [{ game: 'adopt-me', categories: ['items', 'currency'] }], discord: '@trader.one', isAdult: true, source: 'banner' })
    expect(ok).toEqual({ success: true })
    state = await a.getFoundingFlowState()
    expect(state.stage).toBe(3)
    expect(state.details).toMatchObject({ country: 'GB', discord: 'trader.one', isAdult: true })
    expect(state.details?.sells[0]).toEqual({ game: 'adopt-me', categories: ['items', 'currency'] })

    // 3. store name: validation + uniqueness, then saved
    expect((await a.checkStoreNameAvailable('ab')).available).toBe(false)
    expect((await a.checkStoreNameAvailable('<b>Shop</b>')).available).toBe(false)
    const storeName = `OSS Store ${tag}`
    expect((await a.checkStoreNameAvailable(storeName)).available).toBe(true)
    // a name already on another profile (the fixture seller's shop) is taken, case-insensitively
    await fx!.svc.from('profiles').update({ shop_name: `Taken Shop ${tag}` }).eq('id', fx!.seller.id)
    expect((await a.checkStoreNameAvailable(`taken shop ${tag}`)).available).toBe(false)
    // agreement before the store is refused
    const early = await a.signFoundingAgreement({ typedName: 'Guard Buyer', signatureDataUrl: pngDataUrl(), agreed: true })
    expect(early.success).toBe(false)
    const saved = await a.saveFoundingStore({ storeName })
    expect(saved.success).toBe(true)
    state = await a.getFoundingFlowState()
    expect(state.stage).toBe(4)
    expect(state.store?.name).toBe(storeName)

    // 4. agreement: bad inputs refused, nothing written
    expect((await a.signFoundingAgreement({ typedName: 'G', signatureDataUrl: pngDataUrl(), agreed: true })).success).toBe(false)
    expect((await a.signFoundingAgreement({ typedName: 'Guard Buyer', signatureDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', agreed: true })).success).toBe(false)
    expect((await a.signFoundingAgreement({ typedName: 'Guard Buyer', signatureDataUrl: pngDataUrl(), agreed: false })).success).toBe(false)
    const { data: before } = await fx!.svc.from('seller_agreements').select('id').eq('user_id', fx!.buyer.id).limit(1)
    expect(before ?? []).toEqual([])

    const done = await a.signFoundingAgreement({ typedName: "Guard O'Buyer", signatureDataUrl: pngDataUrl(), agreed: true })
    expect(done.success, done.error).toBe(true)
    expect(done.shopSlug).toMatch(/^oss-store-/)

    // the account is now an unverified seller
    const { data: prof } = await fx!.svc.from('profiles').select('role, seller_status, is_verified, shop_name, shop_slug, founding_seller, full_name').eq('id', fx!.buyer.id).single()
    expect(prof).toMatchObject({ role: 'seller', seller_status: 'active', is_verified: false, shop_name: storeName, shop_slug: done.shopSlug })
    state = await a.getFoundingFlowState()
    expect(state.isSeller).toBe(true)
    expect(state.stage).toBe(5)
    expect(state.agreement?.version).toBe(state.agreementVersion)

    // evidence row: version, 64-hex hash, typed name, first-hop IP, UA, and the PNG in the private bucket
    const { data: ag } = await fx!.svc.from('seller_agreements').select('*').eq('user_id', fx!.buyer.id).single()
    expect(ag).toMatchObject({ agreement_version: state.agreementVersion, typed_name: "Guard O'Buyer", user_agent: 'vitest/open-seller-signup' })
    expect(String((ag as any).ip)).toBe(FAKE_IP)
    expect((ag as any).agreement_sha256).toMatch(/^[0-9a-f]{64}$/)
    const { data: objs } = await fx!.svc.storage.from('seller-signatures').list(fx!.buyer.id)
    expect(objs?.map((o) => `${fx!.buyer.id}/${o.name}`)).toContain((ag as any).signature_path)

    // the gates agree
    const { data: kind } = await fx!.svc.rpc('sell_access_kind' as any, { p_user: fx!.buyer.id })
    expect(kind).toBe('seller')
    const { data: gate } = await fx!.svc.rpc('seller_withdrawal_gate' as any, { p_seller_id: fx!.buyer.id })
    expect(gate).toMatchObject({ eligible: false, reason: 'kyc_required' })
  }, 60_000)
})
