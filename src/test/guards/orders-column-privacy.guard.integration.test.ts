/**
 * orders column privacy (integration) — the DB, not our pages, decides which
 * order columns each party's browser can read.
 *
 * RLS ("Buyers and sellers can view their orders") returns the whole row to
 * both parties, so before 20260927224019 either one could run
 * `supabase.from('orders').select('*')` from the browser console and read the
 * other side's money/payment fields. Now `anon`/`authenticated` hold a
 * column-level SELECT grant on the shared columns only; each party reads its
 * own private fields through an auth.uid()-scoped RPC.
 *
 * Proven here with each party's real session client, by every query shape
 * PostgREST offers: a direct column, '*', a filter or sort on a private
 * column (a boolean oracle), an embed from a related table, the RPCs, and
 * the seller_dashboard_stats view.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'
import {
  ORDER_PARTY_COLUMNS,
  ORDER_SELLER_PRIVATE_COLUMNS,
  ORDER_BUYER_PRIVATE_COLUMNS,
} from '@/lib/orders/columns'

const SELLER_PRIVATE = [
  'seller_payout', 'seller_commission_pct', 'seller_fee_trace', 'platform_fee', 'platform_fee_rate', 'stripe_transfer_id',
]
const BUYER_PRIVATE = [
  'checkout_url', 'wallet_amount_used', 'promo_code_id', 'promo_discount', 'payment_processing_fee',
  'payment_processing_fee_rate', 'provider_charge_id', 'stripe_payment_intent_id', 'payment_provider',
  'buyer_fee_pct', 'buyer_fee_amount', 'buyer_fee_method',
]
const PRIVATE = new Set([...SELLER_PRIVATE, ...BUYER_PRIVATE])

let fx: Fixture | null = null
let orderId = ''
let allColumns: string[] = []

function expectDenied(res: { error: { code?: string; message: string } | null; data: unknown }, what: string) {
  expect(res.error, `${what} must be refused`).not.toBeNull()
  expect(res.error!.code, `${what}: ${res.error!.message}`).toBe('42501')
  expect(res.data, what).toBeNull()
}

describe.skipIf(!hasEnv)('orders column privacy (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    orderId = fx.completedOrderId
    // Give every private column a value, so a leak would be visible as data.
    const { error } = await fx.svc.from('orders').update({
      checkout_url: 'https://pay.example.test/c/guard', wallet_amount_used: 0.5, promo_discount: 0.1,
      payment_processing_fee: 0.03, payment_processing_fee_rate: 0.03, provider_charge_id: 'ch_guard',
      stripe_payment_intent_id: 'pi_guard', payment_provider: 'guard', buyer_fee_pct: 3, buyer_fee_amount: 0.03,
      buyer_fee_method: 'card', platform_fee: 0.2, platform_fee_rate: 0.2, seller_commission_pct: 20,
      seller_fee_trace: { rule_id: 'guardtest' }, stripe_transfer_id: 'tr_guard',
    }).eq('id', orderId)
    if (error) throw new Error(`seed private columns: ${error.message}`)
    const { data, error: re } = await fx.svc.from('orders').select('*').eq('id', orderId).single()
    if (re) throw new Error(`read columns: ${re.message}`)
    allColumns = Object.keys(data as object).sort()
  }, 60_000)

  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('the private sets are real columns of orders (a rename must not silently re-open one)', () => {
    for (const c of PRIVATE) expect(allColumns, c).toContain(c)
  })

  for (const party of ['seller', 'buyer'] as const) {
    it(`${party}: every shared column is selectable, every private column is refused (42501)`, async () => {
      const client = fx![party].client
      for (const col of allColumns) {
        const res = await client.from('orders').select(col).eq('id', orderId)
        if (PRIVATE.has(col)) expectDenied(res, `${party} select ${col}`)
        else {
          expect(res.error, `${party} select ${col}: ${res.error?.message}`).toBeNull()
          expect((res.data as any[]).length, `${party} sees the row via ${col}`).toBe(1)
        }
      }
    })

    it(`${party}: select('*') is refused`, async () => {
      expectDenied(await fx![party].client.from('orders').select('*').eq('id', orderId), `${party} select *`)
    })
  }

  it("the buyer cannot probe the seller's payout through a filter or a sort", async () => {
    const c = fx!.buyer.client
    expectDenied(await c.from('orders').select('id').eq('id', orderId).gte('seller_payout', 0), 'filter seller_payout')
    expectDenied(await c.from('orders').select('id').eq('id', orderId).order('platform_fee'), 'order by platform_fee')
  })

  it("the seller cannot probe the buyer's payment fields through a filter or a sort", async () => {
    const c = fx!.seller.client
    expectDenied(await c.from('orders').select('id').eq('id', orderId).not('checkout_url', 'is', null), 'filter checkout_url')
    expectDenied(await c.from('orders').select('id').eq('id', orderId).order('wallet_amount_used'), 'order by wallet_amount_used')
  })

  it('an embed from a related table cannot reach a private column either', async () => {
    const s = await fx!.seller.client.from('listings')
      .select('id, orders!orders_listing_id_fkey(checkout_url)').eq('id', fx!.listingId)
    expectDenied(s, 'seller listings→orders(checkout_url)')
    const b = await fx!.buyer.client.from('profiles')
      .select('id, orders!orders_buyer_id_fkey(seller_payout)').eq('id', fx!.buyer.id)
    expectDenied(b, 'buyer profiles→orders(seller_payout)')
    // …while the shared columns still embed.
    const ok = await fx!.seller.client.from('listings')
      .select('id, orders!orders_listing_id_fkey(id, order_number)').eq('id', fx!.listingId).single()
    expect(ok.error).toBeNull()
    expect(((ok.data as any).orders as any[]).map((o) => o.id)).toContain(orderId)
  })

  it("orders_seller_private: the seller gets their own payout; the buyer gets nothing", async () => {
    const mine = await fx!.seller.client.rpc('orders_seller_private' as any, { p_order_ids: [orderId] })
    expect(mine.error).toBeNull()
    const row = (mine.data as any[])[0]
    expect(row.id).toBe(orderId)
    expect(Number(row.seller_payout)).toBe(1)
    expect(Number(row.seller_commission_pct)).toBe(20)
    for (const k of BUYER_PRIVATE) expect(row, k).not.toHaveProperty(k)
    const theirs = await fx!.buyer.client.rpc('orders_seller_private' as any, { p_order_ids: [orderId] })
    expect(theirs.error).toBeNull()
    expect(theirs.data).toEqual([])
  })

  it("orders_buyer_private: the buyer gets their own checkout link; the seller gets nothing", async () => {
    const mine = await fx!.buyer.client.rpc('orders_buyer_private' as any, { p_order_ids: [orderId] })
    expect(mine.error).toBeNull()
    const row = (mine.data as any[])[0]
    expect(row.id).toBe(orderId)
    expect(row.checkout_url).toBe('https://pay.example.test/c/guard')
    for (const k of SELLER_PRIVATE) expect(row, k).not.toHaveProperty(k)
    const theirs = await fx!.seller.client.rpc('orders_buyer_private' as any, { p_order_ids: [orderId] })
    expect(theirs.error).toBeNull()
    expect(theirs.data).toEqual([])
  })

  it('the party RPCs are closed to the anon key', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    for (const fn of ['orders_seller_private', 'orders_buyer_private']) {
      const res = await anon.rpc(fn as any, { p_order_ids: [orderId] })
      expect(res.error?.code, `${fn} for anon`).toBe('42501')
    }
  })

  it("seller_dashboard_stats: the seller's select('*') still returns their earnings; the buyer sees none", async () => {
    const mine = await fx!.seller.client.from('seller_dashboard_stats').select('*').eq('seller_id', fx!.seller.id).single()
    expect(mine.error).toBeNull()
    expect(Number((mine.data as any).earnings_all_time)).toBe(1)
    expect(Number((mine.data as any).earnings_today)).toBe(1)
    const theirs = await fx!.buyer.client.from('seller_dashboard_stats').select('*').eq('seller_id', fx!.seller.id)
    expect(theirs.error).toBeNull()
    for (const r of (theirs.data ?? []) as any[]) expect(Number(r.earnings_all_time)).toBe(0)
  })

  it('the service role (money RPCs, crons, webhooks) still reads every column', async () => {
    const { data, error } = await fx!.svc.from('orders').select(SELLER_PRIVATE.concat(BUYER_PRIVATE).join(', ')).eq('id', orderId).single()
    expect(error).toBeNull()
    expect(Number((data as any).seller_payout)).toBe(1)
    expect((data as any).checkout_url).toBe('https://pay.example.test/c/guard')
  })

  it('src/lib/orders/columns.ts matches the grant exactly', () => {
    expect([...ORDER_SELLER_PRIVATE_COLUMNS].sort()).toEqual([...SELLER_PRIVATE].sort())
    expect([...ORDER_BUYER_PRIVATE_COLUMNS].sort()).toEqual([...BUYER_PRIVATE].sort())
    expect([...ORDER_PARTY_COLUMNS].sort()).toEqual(allColumns.filter((c) => !PRIVATE.has(c)))
  })
})
