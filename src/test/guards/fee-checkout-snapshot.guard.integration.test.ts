/**
 * Fee engine PR 3 — checkout reads resolve_seller_fee and writes the snapshot
 * (docs/design/fee-engine.md §3, §7.4, §7.5, §9 A4).
 *
 * Drives the REAL createCheckout (buyer session through PostgREST, service
 * role for the insert — exactly the production path) against the local
 * stack, the same harness as money-atomicity.guard:
 *
 *   · PARITY (§7.4, the PR 3 gate): for EVERY game_categories row, the
 *     seller_payout createCheckout writes equals what the pre-change code path
 *     (commissionAmount over the TS constants) produced, seller_commission_pct
 *     equals commissionPct(), and the trace names a rule (never the fallback).
 *     Deleted in PR 4, where the rates intentionally diverge.
 *   · founding and ranked sellers land the resolver's own pct in the snapshot.
 *   · resolver failure (error, or no row) → 'Could not price this order', no
 *     order row, no wallet debit — never a TS-constant fallback (A4).
 *   · snapshot immutability (§7.5): a later rule change leaves payout, rate
 *     and trace byte-identical; buyer and seller get 42501 on the columns.
 *   · fee_resolution_gaps holds none of the orders this run created.
 *
 * Every row this file causes is removed in afterAll: orders (+ the fake
 * provider's charge rows, the Order-Incomplete nudges), the listings it
 * inserts, ledger journals under RUN, and the fixture users.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import diagnostics_channel from 'node:diagnostics_channel'
import type { SupabaseClient } from '@supabase/supabase-js'

import { commissionAmount, commissionPct, round2 } from '@/lib/fees'
import { ORDER_NUMBER_RE } from '@/lib/orders/order-number'
import { hasEnv, makeFixture, promoteToEstablishedSeller, expectGuardRejection, type Fixture } from './throwaway'

// ── fault switches (set by a test, read by the session-client mock) ────────
let sessionClient: SupabaseClient | null = null
/** 'error' → the RPC returns a PostgREST error; 'empty' → zero rows. */
let feeRpcFault: 'error' | 'empty' | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    // Same client the buyer holds, with ONE seam interceptable: the resolver.
    return new Proxy(sessionClient, {
      get(target, prop, receiver) {
        if (prop !== 'rpc') return Reflect.get(target, prop, receiver)
        return (fn: string, args: Record<string, unknown>) => {
          if (fn === 'resolve_seller_fee' && feeRpcFault === 'error') {
            return Promise.resolve({ data: null, error: { message: 'injected: resolver unreachable', code: '57P01' } })
          }
          if (fn === 'resolve_seller_fee' && feeRpcFault === 'empty') {
            return Promise.resolve({ data: [], error: null })
          }
          return (target.rpc as any)(fn, args)
        }
      },
    })
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

let fx: Fixture | null = null
let ready = false
const CUR = 'USD'
const tag = () => Math.random().toString(36).slice(2, 8)
const RUN = `test:ledger:fee-checkout:${tag()}`
const PRICE = 19.99 // 7% → 1.3993 → rounds; exercises R-2 on both paths

type Pair = { id: string; slug: string; type: string; game_id: string; game: { slug: string } | null }
type Snapshot = { id: string; subtotal: number; seller_payout: number; seller_commission_pct: number | null; seller_fee_trace: Record<string, unknown> | null }

const createdListingIds: string[] = []
const createdOrderIds: string[] = []
const createdRuleIds: string[] = []

async function orderSnapshot(orderId: string): Promise<Snapshot> {
  const { data, error } = await fx!.svc.from('orders').select('id, subtotal, seller_payout, seller_commission_pct, seller_fee_trace').eq('id', orderId).single()
  if (error) throw new Error(`order ${orderId}: ${error.message}`)
  return data as unknown as Snapshot
}
async function resolveFor(sellerId: string | null, pairId: string) {
  const { data, error } = await fx!.svc.rpc('resolve_seller_fee', { p_seller_id: sellerId, p_game_category_id: pairId } as any)
  if (error) throw new Error(`resolve_seller_fee: ${error.message}`)
  return (data as any[])[0] as { pct: number | string; base_pct: number | string; rule_id: string | null; rank: string | null; rank_pts: number | string; founding_applied: boolean; fallback_count: number }
}
async function insertListings(pairs: Pair[]): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < pairs.length; i += 100) {
    const slice = pairs.slice(i, i + 100)
    const { data, error } = await fx!.svc.from('listings').insert(slice.map((p) => ({
      seller_id: fx!.seller.id, game_id: p.game_id, game_category_id: p.id,
      title: `GUARD-TEST-${tag()}`, description: 'fee snapshot throwaway', price: PRICE, quantity: 5, status: 'active',
    }))).select('id, status')
    if (error) throw new Error(`listings insert: ${error.message}`)
    for (const r of data as any[]) {
      if (r.status !== 'active') throw new Error(`listing ${r.id} not active (${r.status}) — seller moderation gate`)
      ids.push(r.id)
    }
  }
  createdListingIds.push(...ids)
  return ids
}
async function checkout(listingId: string, extra: Record<string, unknown> = {}) {
  const { createCheckout } = await import('@/lib/actions/checkout')
  const r = await createCheckout({ listingId, quantity: 1, ...extra })
  if (r.orderId) createdOrderIds.push(r.orderId)
  return r
}
async function walletMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', { p_user_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function fundWallet(userId: string, minor: bigint, suffix: string) {
  const { error } = await fx!.svc.rpc('post_journal', {
    p_idempotency_key: `${RUN}:fund:${suffix}`,
    p_entries: [
      { owner_type: 'platform', owner_id: null, kind: 'refunds', direction: 'debit', amount_minor: Number(minor), currency: CUR },
      { owner_type: 'buyer', owner_id: userId, kind: 'user_wallet', direction: 'credit', amount_minor: Number(minor), currency: CUR },
    ],
    p_event_ref: 'TEST_FUND',
  } as any)
  if (error) throw new Error(`fundWallet: ${error.message}`)
}
/**
 * Transport-level capture for the parity loop. createCheckout's outer catch
 * turns a thrown error into a message and drops the stack; the undici
 * diagnostics channels see every fetch the harness makes (GoTrue, PostgREST)
 * and keep the error object, so a failed checkout can be attributed to the
 * exact request that failed — with its stack — without touching checkout.ts.
 */
const netErrors: string[] = []
const netHttpErrors: string[] = []
const consoleErrors: string[] = []
diagnostics_channel.subscribe('undici:request:error', (msg: any) => {
  const req = msg?.request
  netErrors.push(`${new Date().toISOString()} ${req?.method} ${req?.origin}${req?.path}: ${msg?.error?.message}\n${msg?.error?.stack ?? ''}`)
})
diagnostics_channel.subscribe('undici:request:headers', (msg: any) => {
  const status = msg?.response?.statusCode
  if (status >= 400) {
    const req = msg?.request
    netHttpErrors.push(`${new Date().toISOString()} ${req?.method} ${req?.origin}${req?.path} -> ${status}`)
  }
})
const TRACE_KEYS = ['rule_id', 'rule_kind', 'rule_scope', 'base_pct', 'rank', 'rank_pts', 'founding_applied', 'floor_applied', 'fallback_count', 'resolved_at', 'resolver_version'].sort()

describe.skipIf(!hasEnv)('fee engine PR 3 — createCheckout resolves the rate and snapshots it (integration)', () => {
  let pairs: Pair[] = []
  let fixturePairId = ''

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('fee_engine_version')).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    sessionClient = fx.buyer.client
    const { data, error } = await fx.svc.from('game_categories').select('id, slug, type, game_id, game:games ( slug )').eq('is_enabled', true)
    if (error) throw new Error(`game_categories: ${error.message}`)
    pairs = (data ?? []) as unknown as Pair[]
    const { data: l } = await fx.svc.from('listings').select('game_category_id').eq('id', fx.listingId).single()
    fixturePairId = (l as any).game_category_id
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const svc = fx.svc
    const failures: string[] = []
    const del = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p
      if (error) failures.push(`${label}: ${error.message}`)
    }
    if (createdRuleIds.length) await del('fee_rules', svc.from('fee_rules').delete().in('id', createdRuleIds))
    const { data: allOrders } = await svc.from('orders').select('id').eq('buyer_id', fx.buyer.id)
    const orderIds = Array.from(new Set([...(allOrders ?? []).map((o: any) => o.id), ...createdOrderIds]))
    for (const id of orderIds) {
      await del(`ledger_test_cleanup_by_order(${id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `fake_${id}:%`))
    }
    await del('ledger_test_cleanup(run)', svc.rpc('ledger_test_cleanup', { p_prefix: `${RUN}%` } as any))
    await del('audit_logs', svc.from('audit_logs').delete().in('user_id', [fx.buyer.id, fx.seller.id, fx.admin.id]))
    // orders (by buyer) → listings (by seller) → notifications → users: fixture cleanup, which also verifies no residue.
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`fee-checkout-snapshot cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 180_000)

  it('the fee-engine migrations are applied', () => { expect(ready).toBe(true) })

  it('the catalogue is present (parity over a handful of pairs proves little)', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(1)
    if (pairs.length < 50) {
      // eslint-disable-next-line no-console
      console.warn(`[fee-checkout] only ${pairs.length} enabled pair(s) — run \`pnpm seed:games --env=local\` + re-apply the seed migration for the full proof`)
    }
  })

  // ── §7.4 PARITY — every pair, through the real checkout ──────────────────
  it('PARITY: for every pair, createCheckout writes the payout the TS constants produced, the pct commissionPct() returns, and a ruled trace', async () => {
    const listingIds = await insertListings(pairs)
    const mismatches: string[] = []
    const failures: string[] = []
    const origConsoleError = console.error
    console.error = (...a: unknown[]) => { consoleErrors.push(`${new Date().toISOString()} ${a.map((x) => (x instanceof Error ? `${x.message}\n${x.stack}` : String(x))).join(' ')}`); origConsoleError(...a) }
    const CONC = 8
    try {
    for (let i = 0; i < listingIds.length; i += CONC) {
      const slice = listingIds.slice(i, i + CONC)
      const results = await Promise.all(slice.map((id) => checkout(id)))
      for (let j = 0; j < slice.length; j++) {
        const p = pairs[i + j]
        const label = `${p.game?.slug}/${p.slug} (${p.type})`
        const r = results[j]
        if (!r.success || !r.orderId) {
          // NO retry: a checkout that produced no order is reported with
          // everything the harness saw — the returned error, whether an order
          // row exists anyway (a real race would leave one), the console.error
          // lines and every transport error/HTTP≥400 captured so far.
          const { data: rows } = await fx!.svc.from('orders').select('id, status, created_at').eq('buyer_id', fx!.buyer.id).eq('listing_id', slice[j])
          failures.push([
            `${new Date().toISOString()} ${label} listing=${slice[j]}`,
            `  returned: success=${r.success} error=${JSON.stringify(r.error)} orderId=${r.orderId}`,
            `  order rows for (buyer, listing): ${JSON.stringify(rows)}`,
            `  console.error lines (${consoleErrors.length}):\n    ${consoleErrors.join('\n    ') || '(none)'}`,
            `  undici request errors (${netErrors.length}):\n    ${netErrors.join('\n    ') || '(none)'}`,
            `  HTTP >= 400 responses (${netHttpErrors.length}):\n    ${netHttpErrors.join('\n    ') || '(none)'}`,
          ].join('\n'))
          continue
        }
        const o = await orderSnapshot(r.orderId)
        const input = { categoryMetaType: p.type, categorySlug: p.slug, gameSlug: p.game?.slug ?? null }
        const subtotal = Number(o.subtotal)
        const oldPayout = round2(subtotal - commissionAmount(subtotal, input))
        const oldPct = commissionPct(input)
        if (Number(o.seller_payout) !== oldPayout) mismatches.push(`${label}: payout ${o.seller_payout} ≠ pre-change ${oldPayout}`)
        if (Number(o.seller_commission_pct) !== oldPct) mismatches.push(`${label}: pct ${o.seller_commission_pct} ≠ commissionPct ${oldPct}`)
        const t = o.seller_fee_trace
        if (!t) { mismatches.push(`${label}: no seller_fee_trace`); continue }
        if (t.rule_id == null) mismatches.push(`${label}: trace.rule_id NULL (fallback)`)
        if (Number(t.fallback_count) !== 0) mismatches.push(`${label}: fallback_count ${t.fallback_count}`)
        if (Number(t.resolver_version) !== 1) mismatches.push(`${label}: resolver_version ${t.resolver_version}`)
        const keys = Object.keys(t).sort()
        if (keys.join(',') !== TRACE_KEYS.join(',')) mismatches.push(`${label}: trace keys ${keys.join(',')}`)
      }
    }
    } finally {
      console.error = origConsoleError
    }
    expect(failures, `${failures.length} checkout(s) produced no order:\n${failures.join('\n\n')}`).toEqual([])
    expect(mismatches, `${mismatches.length} pair(s) differ from the pre-change path:\n${mismatches.join('\n')}`).toEqual([])
  }, 600_000)

  // ── seller adjustments land in the snapshot ─────────────────────────────
  it('founding seller: the snapshot carries the resolver pct (base × 0.5) and founding_applied', async () => {
    // Anchor founding_since on the seller's created_at (what the PR 1 backfill
    // does), NOT on the JS clock: the resolver compares the anchor with the
    // database's now(), and the local Docker VM clock sits up to a few hundred
    // ms either side of the host's — a "now" stamped here was seen landing in
    // the DB's future (founding_applied=false) in 2 of 20 runs.
    const { data: prof, error: pe } = await fx!.svc.from('profiles').select('created_at').eq('id', fx!.seller.id).single()
    expect(pe, pe?.message).toBeNull()
    const { error } = await fx!.svc.from('profiles').update({ founding_seller: true, founding_since: (prof as any).created_at }).eq('id', fx!.seller.id)
    expect(error, error?.message).toBeNull()
    try {
      const [listingId] = await insertListings([pairs.find((p) => p.id === fixturePairId)!])
      const expected = await resolveFor(fx!.seller.id, fixturePairId)
      expect(expected.founding_applied).toBe(true)
      const r = await checkout(listingId)
      expect(r.success, r.error).toBe(true)
      const o = await orderSnapshot(r.orderId!)
      expect(Number(o.seller_commission_pct)).toBe(Number(expected.pct))
      expect(Number(o.seller_commission_pct)).toBe(Number(expected.base_pct) * 0.5)
      expect(o.seller_fee_trace).toMatchObject({ founding_applied: true, rank_pts: 0, rule_id: expected.rule_id })
      expect(Number(o.seller_payout)).toBe(round2(PRICE - round2((PRICE * Number(expected.pct)) / 100)))
    } finally {
      await fx!.svc.from('profiles').update({ founding_seller: false, founding_since: null }).eq('id', fx!.seller.id)
    }
  }, 60_000)

  it('ranked seller: the snapshot carries the resolver pct and names the rank', async () => {
    const { data: prof } = await fx!.svc.from('profiles').select('seller_tier, founding_seller').eq('id', fx!.seller.id).single()
    expect((prof as any).founding_seller).toBe(false)
    const tier = (prof as any).seller_tier as string
    expect(tier).toBeTruthy()
    const [listingId] = await insertListings([pairs.find((p) => p.id === fixturePairId)!])
    const expected = await resolveFor(fx!.seller.id, fixturePairId)
    expect(expected.founding_applied).toBe(false)
    const r = await checkout(listingId)
    expect(r.success, r.error).toBe(true)
    const o = await orderSnapshot(r.orderId!)
    expect(Number(o.seller_commission_pct)).toBe(Number(expected.pct))
    expect(o.seller_fee_trace).toMatchObject({ rank: tier, rank_pts: Number(expected.rank_pts), founding_applied: false, rule_id: expected.rule_id })
    expect(Number(o.seller_payout)).toBe(round2(PRICE - round2((PRICE * Number(expected.pct)) / 100)))
  }, 60_000)

  // ── A4: fail closed ─────────────────────────────────────────────────────
  for (const fault of ['error', 'empty'] as const) {
    it(`resolver ${fault} → "Could not price this order", no order row, no wallet debit`, async () => {
      const [listingId] = await insertListings([pairs.find((p) => p.id === fixturePairId)!])
      await fundWallet(fx!.buyer.id, 500n, fault)
      const before = await walletMinor(fx!.buyer.id)
      expect(before).toBeGreaterThanOrEqual(500n)
      feeRpcFault = fault
      let r: Awaited<ReturnType<typeof checkout>>
      try { r = await checkout(listingId, { walletAmount: 5 }) } finally { feeRpcFault = null }
      expect(r.success).toBe(false)
      expect(r.error).toBe('Could not price this order')
      expect(r.orderId).toBeUndefined()
      const { data: rows } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id).eq('listing_id', listingId)
      expect(rows).toEqual([])
      expect(await walletMinor(fx!.buyer.id)).toBe(before)
      // The fault was the only thing in the way: the same listing prices fine once it clears.
      const ok = await checkout(listingId)
      expect(ok.success, ok.error).toBe(true)
    }, 60_000)
  }

  // ── §7.5 snapshot immutability ──────────────────────────────────────────
  it('a later rule change leaves a past order\'s payout, rate and trace byte-identical; a new order sees the new rate', async () => {
    const [before, after] = await insertListings([pairs.find((p) => p.id === fixturePairId)!, pairs.find((p) => p.id === fixturePairId)!])
    const r1 = await checkout(before)
    expect(r1.success, r1.error).toBe(true)
    const snap = await orderSnapshot(r1.orderId!)
    expect(snap.seller_commission_pct).not.toBeNull()

    // A 0% promo on the pair, effective now (promos need no notice) — the resolver's answer changes...
    const { data: rule, error } = await fx!.svc.from('fee_rules').insert({
      kind: 'promo', scope: 'game_category', category_type: pairs.find((p) => p.id === fixturePairId)!.type, game_category_id: fixturePairId, pct: 0,
      starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 86_400_000).toISOString(), note: 'FEE-TEST-pr3-immutability',
    }).select('id').single()
    expect(error, error?.message).toBeNull()
    createdRuleIds.push((rule as any).id)
    expect(Number((await resolveFor(fx!.seller.id, fixturePairId)).pct)).toBe(0)

    // ...the stored order does not.
    expect(await orderSnapshot(r1.orderId!)).toEqual(snap)

    // A NEW order is priced by the new rule (the snapshot is a copy, not a reference).
    const r2 = await checkout(after)
    expect(r2.success, r2.error).toBe(true)
    const snap2 = await orderSnapshot(r2.orderId!)
    expect(Number(snap2.seller_commission_pct)).toBe(0)
    expect(Number(snap2.seller_payout)).toBe(PRICE)
    expect(snap2.seller_fee_trace).toMatchObject({ rule_id: (rule as any).id, rule_kind: 'promo', rule_scope: 'game_category' })

    await fx!.svc.from('fee_rules').delete().eq('id', (rule as any).id)
    createdRuleIds.splice(createdRuleIds.indexOf((rule as any).id), 1)
    expect(await orderSnapshot(r2.orderId!)).toEqual(snap2)
  }, 60_000)

  it('neither buyer nor seller can rewrite seller_commission_pct / seller_fee_trace on a checkout-created order (42501)', async () => {
    const [listingId] = await insertListings([pairs.find((p) => p.id === fixturePairId)!])
    const r = await checkout(listingId)
    expect(r.success, r.error).toBe(true)
    const snap = await orderSnapshot(r.orderId!)
    for (const actor of [fx!.buyer, fx!.seller]) {
      const res = await actor.client.from('orders').update({ seller_commission_pct: 0, seller_fee_trace: { rule_id: null } }).eq('id', r.orderId!).select('id')
      expectGuardRejection(res, 'orders')
    }
    expect(await orderSnapshot(r.orderId!)).toEqual(snap)
  }, 60_000)

  // ── order numbers (migrations 20260921230440 + 20260921234649) ──────────
  it('every order this run created has a DM-XXXX-XXXX crypto-random order_number from the unambiguous alphabet, all distinct', async () => {
    expect(createdOrderIds.length).toBeGreaterThan(0)
    const numbers: string[] = []
    for (let i = 0; i < createdOrderIds.length; i += 100) {
      const { data, error } = await fx!.svc.from('orders').select('order_number').in('id', createdOrderIds.slice(i, i + 100))
      expect(error, error?.message).toBeNull()
      numbers.push(...(data as any[]).map((r) => r.order_number))
    }
    const bad = numbers.filter((n) => !ORDER_NUMBER_RE.test(n ?? ''))
    expect(bad, 'order numbers outside the DM-XXXX-XXXX format').toEqual([])
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('generate_order_number is service-role only (a definer that reads every order must not be callable by a session)', async () => {
    const svc = await fx!.svc.rpc('generate_order_number' as any)
    expect(svc.error, 'service role must still be able to draw a number').toBeNull()
    expect(String(svc.data)).toMatch(ORDER_NUMBER_RE)
    for (const actor of [fx!.buyer, fx!.seller]) {
      const { error } = await actor.client.rpc('generate_order_number' as any)
      expect(error, 'session client must be refused').not.toBeNull()
      expect(error!.code).toBe('42501')
    }
  })

  // ── ops invariant ───────────────────────────────────────────────────────
  it('fee_resolution_gaps contains none of the orders this run created', async () => {
    expect(createdOrderIds.length).toBeGreaterThan(0)
    const gaps: string[] = []
    const nulls: string[] = []
    for (let i = 0; i < createdOrderIds.length; i += 100) {
      const ids = createdOrderIds.slice(i, i + 100)
      const { data, error } = await fx!.svc.from('fee_resolution_gaps').select('id').in('id', ids)
      expect(error, error?.message).toBeNull()
      gaps.push(...(data as any[]).map((r) => r.id))
      const { data: n, error: ne } = await fx!.svc.from('orders').select('id').in('id', ids).or('seller_commission_pct.is.null,seller_fee_trace.is.null')
      expect(ne, ne?.message).toBeNull()
      nulls.push(...(n as any[]).map((r) => r.id))
    }
    expect(gaps, 'orders priced through the fallback').toEqual([])
    expect(nulls, 'every checkout-created order carries the snapshot').toEqual([])
  })
})
