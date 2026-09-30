/**
 * Buyer service fee (docs/design/buyer-fee-refund-policy.md, 2026-09-29):
 * marketplace max($0.30, 2%) + the method's processing fee on the amount the
 * provider is actually charged, order total topped up to $1.00, zero for
 * store credit — all inside buyer_fee_quote, snapshotted by
 * order_create_pending. Reads only, except the one order the snapshot test
 * creates and removes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
const CUR = 'USD'

async function q(method: string, sub: number, promo = 0, wallet = 0): Promise<Record<string, any>> {
  const { data, error } = await (fx!.svc.rpc as any)('buyer_fee_quote', {
    p_method: method,
    p_subtotal_minor: sub,
    p_currency: CUR,
    p_promo_minor: promo,
    p_wallet_minor: wallet,
  })
  if (error) throw new Error(`buyer_fee_quote: ${error.message}`)
  return data as Record<string, any>
}
const n = (v: unknown) => Number(v)

describe.skipIf(!hasEnv)('buyer_fee_quote — service fee policy (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  })
  afterAll(async () => {
    await fx?.cleanup()
  })

  it('crypto $20: marketplace 2% = $0.40, processing 5% of $20.40 = $1.02, total $21.42', async () => {
    const r = await q('btcpay', 2000)
    expect(r.ok).toBe(true)
    expect(n(r.marketplace_minor)).toBe(40)
    expect(n(r.fee_minor)).toBe(102)
    expect(n(r.service_fee_minor)).toBe(142)
    expect(n(r.total_minor)).toBe(2142)
    expect(n(r.charge_minor)).toBe(2142)
    expect(n(r.wallet_applied_minor)).toBe(0)
  })

  it('crypto $5: the $0.30 minimum beats 2% ($0.10)', async () => {
    const r = await q('btcpay', 500)
    expect(n(r.marketplace_minor)).toBe(30)
    // processing 5% of $5.30 = $0.27 (rounded half away from zero: 26.5 → 27)
    expect(n(r.fee_minor)).toBe(27)
    expect(n(r.total_minor)).toBe(557)
  })

  it('crypto $0.50: the marketplace fee is raised so the order total reaches $1.00', async () => {
    const r = await q('btcpay', 50)
    expect(r.ok).toBe(true)
    expect(n(r.total_minor)).toBeGreaterThanOrEqual(100)
    expect(n(r.total_minor)).toBeLessThanOrEqual(103)
    expect(50 + n(r.marketplace_minor) + n(r.fee_minor)).toBe(n(r.total_minor))
    expect(n(r.marketplace_minor)).toBeGreaterThan(30)
  })

  it('store credit: zero marketplace, zero processing, total = subtotal − promo, nothing to charge', async () => {
    const r = await q('wallet', 2000, 300)
    expect(r.ok).toBe(true)
    expect(n(r.marketplace_minor)).toBe(0)
    expect(n(r.fee_minor)).toBe(0)
    expect(n(r.service_fee_minor)).toBe(0)
    expect(n(r.total_minor)).toBe(1700)
    expect(n(r.charge_minor)).toBe(0)
  })

  it('store credit is not topped up to the $1.00 minimum', async () => {
    const r = await q('wallet', 50)
    expect(n(r.total_minor)).toBe(50)
  })

  it('partial store credit: processing is charged on the remainder only', async () => {
    const full = await q('btcpay', 2000)
    const part = await q('btcpay', 2000, 0, 1000)
    expect(n(part.marketplace_minor)).toBe(40)
    expect(n(part.wallet_applied_minor)).toBe(1000)
    // 5% of (2040 − 1000) = 52
    expect(n(part.fee_minor)).toBe(52)
    expect(n(part.fee_minor)).toBeLessThan(n(full.fee_minor))
    expect(n(part.total_minor)).toBe(2000 + 40 + 52)
    expect(n(part.charge_minor)).toBe(2040 - 1000 + 52)
  })

  it('a promo reduces the processing base and the total', async () => {
    const r = await q('btcpay', 2000, 500)
    // 5% of (2040 − 500) = 77
    expect(n(r.fee_minor)).toBe(77)
    expect(n(r.total_minor)).toBe(2000 + 40 + 77 - 500)
  })

  it('the 3-argument call still resolves (old build during deploy)', async () => {
    const { data, error } = await (fx!.svc.rpc as any)('buyer_fee_quote', { p_method: 'btcpay', p_subtotal_minor: 2000, p_currency: CUR })
    expect(error).toBeNull()
    expect(n(data.total_minor)).toBe(2142)
    const many = await (fx!.svc.rpc as any)('buyer_fee_quote_many', { p_methods: ['btcpay', 'wallet'], p_subtotal_minor: 2000, p_currency: CUR })
    expect(many.error).toBeNull()
    expect(many.data.map((r: any) => n(r.total_minor))).toEqual([2142, 2000])
  })

  it('order_create_pending snapshots marketplace → platform_fee and processing → payment_processing_fee', async () => {
    // The fixture buyer already holds a pending order on this listing
    // (one_pending_order_per_buyer_listing), so the admin actor buys here.
    const { data, error } = await (fx!.svc.rpc as any)('order_create_pending', {
      p_buyer_id: fx!.admin.id,
      p_seller_id: fx!.seller.id,
      p_listing_id: fx!.listingId,
      p_quantity: 1,
      p_unit_price: 20,
      p_subtotal: 20,
      // Ignored by the RPC: the quote is the marketplace fee.
      p_platform_fee_rate: 0,
      p_platform_fee: 0,
      p_seller_payout: 18,
      p_seller_commission_pct: 10,
      p_seller_fee_trace: {},
      p_currency: CUR,
      p_promo_code_id: null,
      p_promo_discount: 0,
      p_wallet_minor: 0,
      p_provider: 'btcpay',
      p_pm_id: null,
      p_fallback_expires_at: new Date(Date.now() + 3600e3).toISOString(),
      p_buyer_fee_method: 'btcpay',
    })
    expect(error).toBeNull()
    const orderId = data.order_id as string
    try {
      const { data: o } = await fx!.svc
        .from('orders')
        .select('platform_fee, platform_fee_rate, payment_processing_fee, buyer_fee_amount, total_amount')
        .eq('id', orderId)
        .single()
      const row = o as any
      expect(Number(row.platform_fee)).toBe(0.4)
      expect(Number(row.platform_fee_rate)).toBe(2)
      expect(Number(row.payment_processing_fee)).toBe(1.02)
      expect(Number(row.buyer_fee_amount)).toBe(1.02)
      expect(Number(row.total_amount)).toBe(21.42)
      expect(n(data.marketplace_minor)).toBe(40)
      expect(n(data.service_fee_minor)).toBe(142)
      expect(n(data.charge_minor)).toBe(2142)
    } finally {
      await fx!.svc.from('payment_attempts').delete().eq('order_id', orderId)
      await fx!.svc.from('orders').delete().eq('id', orderId)
    }
  })
})
