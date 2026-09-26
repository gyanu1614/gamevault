/**
 * Fee engine PR 5 — preview == checkout (docs/design/fee-engine.md §7.4).
 *
 * The test that would have caught M7/M8 (the sell wizard quoting 7% where
 * checkout charged 10%, and founding sellers never seeing their discount):
 * for a matrix of pairs × seller states, the pct the sell wizard's server
 * action shows (previewSellerFee, THIS seller's session) must equal
 *
 *   · resolve_seller_fee(seller, pair) — the checkout path's inputs, and
 *   · the seller_commission_pct a REAL createCheckout stamps on the order
 *     for the same seller + pair (buyer session through PostgREST, service
 *     role for the insert — the production path, same harness as
 *     fee-checkout-snapshot.guard),
 *
 * and the wizard's net (round2(price − round2(price × pct / 100))) must equal
 * the order's seller_payout. Seller states: the fixture's established rank,
 * founding-active, founding-expired (founding_since 13 months back on a
 * 12-month programme → back to the rank rate). Every row the run causes is
 * removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { round2 } from '@/lib/fees'
import { hasEnv, makeFixture, promoteToEstablishedSeller, URL, SVC, type Fixture } from './throwaway'

/** Which session the mocked cookie client hands out: the seller (preview) or the buyer (checkout). */
let sessionClient: SupabaseClient | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: unknown) => fn }))
// PAY-007 (PR #88): createCheckout is rate-limited per buyer (20/min). The
// three states below drive ~24 checkouts through ONE buyer inside a minute,
// so the limiter is stubbed open here exactly as fee-checkout-snapshot does;
// the limiter itself is tested in checkout-fix-a.guard.integration.test.ts.
vi.mock('@/lib/security/rate-limit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/security/rate-limit')>()
  return { ...real, checkRateLimit: async (name: string, id: string) => ({ limited: false, retryAfter: 60, key: `${name}:${id}` }) }
})
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

let fx: Fixture | null = null
let ready = false
const CUR = 'USD'
const tag = () => Math.random().toString(36).slice(2, 8)
const RUN = `test:ledger:fee-preview:${tag()}`
const PRICE = 23.45

type Pair = { id: string; slug: string; type: string; game_id: string; game: { slug: string } | null }
const createdListingIds: string[] = []
const createdOrderIds: string[] = []

async function preview(pairId: string) {
  sessionClient = fx!.seller.client
  const { previewSellerFee } = await import('@/lib/actions/fee-preview')
  return previewSellerFee({ gameCategoryId: pairId })
}
async function resolveFor(sellerId: string | null, pairId: string) {
  const { data, error } = await fx!.svc.rpc('resolve_seller_fee', { p_seller_id: sellerId, p_game_category_id: pairId } as any)
  if (error) throw new Error(`resolve_seller_fee: ${error.message}`)
  return (data as any[])[0] as { pct: number | string; founding_applied: boolean; rank: string | null; rank_pts: number | string }
}
async function insertListing(p: Pair): Promise<string> {
  const { data, error } = await fx!.svc.from('listings').insert({
    seller_id: fx!.seller.id, game_id: p.game_id, game_category_id: p.id,
    title: `GUARD-TEST-${tag()}`, description: 'fee preview parity throwaway', price: PRICE, quantity: 5, status: 'active',
  }).select('id, status').single()
  if (error) throw new Error(`listing insert: ${error.message}`)
  if ((data as any).status !== 'active') throw new Error(`listing not active (${(data as any).status})`)
  createdListingIds.push((data as any).id)
  return (data as any).id
}
async function checkout(listingId: string) {
  sessionClient = fx!.buyer.client
  const { createCheckout } = await import('@/lib/actions/checkout')
  const r = await createCheckout({ listingId, quantity: 1 })
  if (r.orderId) createdOrderIds.push(r.orderId)
  return r
}
async function orderSnapshot(orderId: string) {
  const { data, error } = await fx!.svc.from('orders').select('subtotal, seller_payout, seller_commission_pct').eq('id', orderId).single()
  if (error) throw new Error(error.message)
  return data as unknown as { subtotal: number; seller_payout: number; seller_commission_pct: number | null }
}
/** One pair per category type plus a Roblox-economy currency and a high-band account when the catalogue has them. */
function pickMatrix(pairs: Pair[]): Pair[] {
  const out = new Map<string, Pair>()
  for (const type of ['currency', 'items', 'account', 'top_up', 'service', 'gift_card']) {
    const p = pairs.find((x) => x.type === type)
    if (p) out.set(p.id, p)
  }
  for (const slug of ['grow-a-garden', 'fisch', 'steal-a-brainrot']) {
    const p = pairs.find((x) => x.type === 'currency' && x.game?.slug === slug)
    if (p) { out.set(p.id, p); break }
  }
  for (const slug of ['gta-v', 'gta-vi', 'fortnite']) {
    const p = pairs.find((x) => x.type === 'account' && x.game?.slug === slug)
    if (p) { out.set(p.id, p); break }
  }
  return [...out.values()]
}

describe.skipIf(!hasEnv)('fee engine PR 5 — the sell-wizard preview equals what checkout stamps (integration)', () => {
  let matrix: Pair[] = []

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    // PAY-007 (PR #88) caps a buyer at 5 open pending orders; this matrix
    // drives ~8 checkouts per state through ONE buyer and never pays them.
    // Same override the 405-order parity loop uses (fee-checkout-snapshot).
    process.env.CHECKOUT_MAX_OPEN_PENDING_ORDERS = '100000'
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('fee_engine_version')).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    const { data, error } = await fx.svc.from('game_categories').select('id, slug, type, game_id, game:games ( slug )').eq('is_enabled', true)
    if (error) throw new Error(`game_categories: ${error.message}`)
    matrix = pickMatrix((data ?? []) as unknown as Pair[])
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const svc = fx.svc
    const failures: string[] = []
    const del = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p
      if (error) failures.push(`${label}: ${error.message}`)
    }
    const { data: allOrders } = await svc.from('orders').select('id').eq('buyer_id', fx.buyer.id)
    const orderIds = Array.from(new Set([...(allOrders ?? []).map((o: any) => o.id), ...createdOrderIds]))
    for (const id of orderIds) {
      await del(`ledger_test_cleanup_by_order(${id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `fake_${id}:%`))
    }
    await del('ledger_test_cleanup(run)', svc.rpc('ledger_test_cleanup', { p_prefix: `${RUN}%` } as any))
    await del('audit_logs', svc.from('audit_logs').delete().in('user_id', [fx.buyer.id, fx.seller.id, fx.admin.id]))
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`fee-preview-parity cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 180_000)

  it('the fee-engine migrations are applied and the matrix is non-trivial', () => {
    expect(ready).toBe(true)
    expect(matrix.length).toBeGreaterThanOrEqual(2)
  })

  it('unauthenticated preview is refused (no seller, no rate)', async () => {
    sessionClient = { auth: { getUser: async () => ({ data: { user: null } }) } } as unknown as SupabaseClient
    const { previewSellerFee } = await import('@/lib/actions/fee-preview')
    const r = await previewSellerFee({ gameCategoryId: matrix[0].id })
    expect(r).toEqual({ ok: false, error: 'Sign in to see your fee' })
  })

  it('a missing pair never yields a number', async () => {
    const r = await preview('')
    expect(r.ok).toBe(false)
  })

  for (const state of ['ranked', 'founding-active', 'founding-expired'] as const) {
    it(`${state}: preview pct == resolver == the pct createCheckout stamps, and preview net == seller_payout, on every matrix pair`, async () => {
      const { data: prof } = await fx!.svc.from('profiles').select('created_at').eq('id', fx!.seller.id).single()
      const createdAt = new Date((prof as any).created_at)
      const expired = new Date(createdAt); expired.setUTCMonth(expired.getUTCMonth() - 13)
      const patch =
        state === 'ranked' ? { founding_seller: false, founding_since: null }
        : state === 'founding-active' ? { founding_seller: true, founding_since: createdAt.toISOString() }
        : { founding_seller: true, founding_since: expired.toISOString() }
      const { error: pe } = await fx!.svc.from('profiles').update(patch).eq('id', fx!.seller.id)
      expect(pe, pe?.message).toBeNull()
      try {
        const mismatches: string[] = []
        for (const p of matrix) {
          const label = `${p.game?.slug}/${p.slug} (${p.type})`
          const pv = await preview(p.id)
          if (!pv.ok) { mismatches.push(`${label}: preview failed — ${pv.error}`); continue }
          const rs = await resolveFor(fx!.seller.id, p.id)
          if (pv.pct !== Number(rs.pct)) mismatches.push(`${label}: preview ${pv.pct} ≠ resolver ${rs.pct}`)
          if (pv.foundingApplied !== rs.founding_applied) mismatches.push(`${label}: preview founding ${pv.foundingApplied} ≠ resolver ${rs.founding_applied}`)
          if (state === 'founding-active' && !pv.foundingApplied) mismatches.push(`${label}: founding seller sees no founding rate`)
          if (state === 'founding-expired' && pv.foundingApplied) mismatches.push(`${label}: expired founding still applied`)

          const listingId = await insertListing(p)
          const r = await checkout(listingId)
          if (!r.success || !r.orderId) { mismatches.push(`${label}: checkout failed — ${r.error}`); continue }
          const o = await orderSnapshot(r.orderId)
          const subtotal = Number(o.subtotal)
          if (Number(o.seller_commission_pct) !== pv.pct) mismatches.push(`${label}: checkout stamped ${o.seller_commission_pct}, preview showed ${pv.pct}`)
          const net = round2(subtotal - round2((subtotal * pv.pct) / 100))
          if (Number(o.seller_payout) !== net) mismatches.push(`${label}: preview net ${net} ≠ seller_payout ${o.seller_payout}`)
        }
        expect(mismatches, mismatches.join('\n')).toEqual([])
      } finally {
        await fx!.svc.from('profiles').update({ founding_seller: false, founding_since: null }).eq('id', fx!.seller.id)
      }
    }, 180_000)
  }

  it('the anonymous headline (p_seller_id NULL) differs from a discounted seller\'s preview only by the seller adjustment', async () => {
    const p = matrix.find((x) => x.type === 'account') ?? matrix[0]
    const headline = await resolveFor(null, p.id)
    const pv = await preview(p.id)
    expect(pv.ok).toBe(true)
    if (!pv.ok) return
    const rs = await resolveFor(fx!.seller.id, p.id)
    expect(pv.pct).toBe(Number(rs.pct))
    expect(round2(Number(headline.pct) - Number(rs.rank_pts))).toBeGreaterThanOrEqual(pv.pct)
  })
})

/**
 * /sell/fees per-game table (post-deploy fix 1): the public schedule must list
 * every pair that carries its own rule now OR from the next dated change, at
 * the resolver's headline rate now and at that change. Before the fix a pair
 * whose rule had not started yet (37 on prod from 7 Oct: Roblox economies,
 * CoD/Fortnite/R6 accounts…) was missing from the page entirely.
 */
describe.skipIf(!hasEnv)('fee engine — /sell/fees per-game "From" column == resolver (integration)', () => {
  it('lists every ruled pair with rate now == resolver(now) and nextPct == resolver(nextChange)', async () => {
    const svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const { getPublicFeeSchedule } = await import('@/lib/fees/public-rates')
    const s = await getPublicFeeSchedule()

    const [{ data: rules, error: re }, { data: pairs, error: pe }] = await Promise.all([
      svc.from('fee_rules').select('kind, scope, game_category_id, starts_at, ends_at'),
      svc.from('game_categories').select('id, slug, type, game:games!game_categories_game_id_fkey ( slug, is_active )').eq('is_enabled', true),
    ])
    expect(re?.message ?? null).toBeNull()
    expect(pe?.message ?? null).toBeNull()
    const ms = (iso: string) => new Date(iso).getTime()
    const activeAt = (r: any, iso: string) => ms(r.starts_at) <= ms(iso) && (r.ends_at == null || ms(r.ends_at) > ms(iso))
    const live = ((pairs ?? []) as any[]).filter((p) => p.game?.is_active && p.type)
    const liveIds = new Set(live.map((p) => p.id as string))
    const byKey = new Map(live.map((p) => [`${p.game.slug}/${p.slug}`, p.id as string]))
    const pairRules = ((rules ?? []) as any[]).filter((r) => r.scope === 'game_category' && r.game_category_id && liveIds.has(r.game_category_id))
    const expected = new Set(
      pairRules
        .filter((r) => activeAt(r, s.generatedAt) || (s.nextChange != null && activeAt(r, s.nextChange)))
        .map((r) => r.game_category_id as string),
    )
    const listed = new Set(s.overrides.map((o) => byKey.get(`${o.gameSlug}/${o.categorySlug}`)))
    expect([...expected].filter((id) => !listed.has(id)), 'ruled pairs missing from /sell/fees').toEqual([])

    const resolve = async (pairId: string, pAt?: string) => {
      const args: Record<string, unknown> = { p_seller_id: null, p_game_category_id: pairId }
      if (pAt) args.p_at = pAt
      const { data, error } = await svc.rpc('resolve_seller_fee', args as any)
      if (error) throw new Error(error.message)
      return Number((data as any[])[0].pct)
    }
    const mismatches: string[] = []
    for (const o of s.overrides) {
      const id = byKey.get(`${o.gameSlug}/${o.categorySlug}`)!
      const nowPct = await resolve(id)
      if (o.pct !== nowPct) mismatches.push(`${o.gameSlug}/${o.categorySlug}: page ${o.pct} ≠ resolver now ${nowPct}`)
      const nextPct = s.nextChange ? await resolve(id, s.nextChange) : null
      const want = nextPct != null && nextPct !== nowPct ? nextPct : null
      if (o.nextPct !== want) mismatches.push(`${o.gameSlug}/${o.categorySlug}: page next ${o.nextPct} ≠ resolver at ${s.nextChange} ${want}`)
    }
    expect(mismatches, mismatches.join('\n')).toEqual([])

    // A dated pair rule that moves a rate must surface in the column (the page shows it iff some nextPct != null).
    const datedPairChange = s.nextChange != null && pairRules.some((r) => r.kind === 'base' && ms(r.starts_at) === ms(s.nextChange!))
    if (datedPairChange) expect(s.overrides.some((o) => o.nextPct != null)).toBe(true)
  }, 120_000)
})
