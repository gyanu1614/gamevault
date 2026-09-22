/**
 * Order numbers (migration 20260921234649) — format, uniqueness, and the
 * normalised lookup that finds GV- and DM- orders alike.
 *
 *   · generate_order_number() issues DM-XXXX-XXXX from the unambiguous
 *     alphabet; 200 draws are all distinct; the trigger stamps new rows with it.
 *   · an order carrying a legacy GV- number is stored and read back as-is —
 *     nothing rewrites it.
 *   · orders.order_number_search normalises exactly as normalizeOrderNumber()
 *     does, so a query typed with/without dashes, spaces or case finds the
 *     order through the same ilike the admin/seller searches use.
 *
 * Rows this file causes: the fixture (users, listing, two orders) plus ONE
 * extra order with an explicit GV- number; all removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { ORDER_NUMBER_RE, normalizeOrderNumber, orderNumberSearchPattern } from '@/lib/orders/order-number'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let legacyOrderId: string | null = null
const LEGACY_NUMBER = 'GV-123456'

describe.skipIf(!hasEnv)('order numbers — DM- format, uniqueness, normalised lookup (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    // A row issued under the old generator: explicit number, trigger skips it.
    const { data, error } = await fx.svc.from('orders').insert({
      buyer_id: fx.buyer.id, seller_id: fx.seller.id, listing_id: fx.listingId, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
      status: 'completed', escrow_status: 'released', completed_at: new Date().toISOString(),
      order_number: LEGACY_NUMBER,
    }).select('id').single()
    if (error) throw new Error(`legacy order insert: ${error.message}`)
    legacyOrderId = (data as any).id
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (legacyOrderId) await fx.svc.from('orders').delete().eq('id', legacyOrderId)
    await fx.cleanup()
  }, 60_000)

  it('generate_order_number() issues DM-XXXX-XXXX; 200 draws are distinct', async () => {
    const draws: string[] = []
    for (let i = 0; i < 200; i++) {
      const { data, error } = await fx!.svc.rpc('generate_order_number' as any)
      expect(error, error?.message).toBeNull()
      draws.push(String(data))
    }
    const bad = draws.filter((n) => !ORDER_NUMBER_RE.test(n))
    expect(bad, 'draws outside DM-XXXX-XXXX').toEqual([])
    expect(new Set(draws).size).toBe(200)
  }, 60_000)

  it('the trigger stamps a new order with the DM- format', async () => {
    const { data, error } = await fx!.svc.from('orders').select('order_number').in('id', [fx!.pendingOrderId, fx!.completedOrderId])
    expect(error, error?.message).toBeNull()
    const numbers = (data as any[]).map((r) => r.order_number as string)
    expect(numbers).toHaveLength(2)
    for (const n of numbers) expect(n).toMatch(ORDER_NUMBER_RE)
    expect(new Set(numbers).size).toBe(2)
  })

  it('a legacy GV- number is stored and read back exactly as issued', async () => {
    const { data, error } = await fx!.svc.from('orders').select('order_number, order_number_search').eq('id', legacyOrderId!).single()
    expect(error, error?.message).toBeNull()
    expect((data as any).order_number).toBe(LEGACY_NUMBER)
    expect((data as any).order_number_search).toBe(normalizeOrderNumber(LEGACY_NUMBER))
  })

  it('order_number_search equals normalizeOrderNumber(order_number) for every fixture row (DB and TS agree)', async () => {
    const { data, error } = await fx!.svc.from('orders').select('order_number, order_number_search')
      .in('id', [fx!.pendingOrderId, fx!.completedOrderId, legacyOrderId!])
    expect(error, error?.message).toBeNull()
    for (const r of data as any[]) expect(r.order_number_search).toBe(normalizeOrderNumber(r.order_number))
  })

  it('normalised lookup finds the DM- order typed lower-case, without dashes, or with spaces', async () => {
    const { data: row } = await fx!.svc.from('orders').select('order_number').eq('id', fx!.pendingOrderId).single()
    const n = (row as any).order_number as string // DM-ABCD-EFGH
    const body = n.slice(3) // ABCD-EFGH
    const variants = [n.toLowerCase(), n.replace(/-/g, ''), `dm ${body.slice(0, 4)} ${body.slice(5)}`, ` ${n} `]
    for (const typed of variants) {
      const { data, error } = await fx!.svc.from('orders').select('id')
        .ilike('order_number_search', orderNumberSearchPattern(typed))
        .in('id', [fx!.pendingOrderId, fx!.completedOrderId, legacyOrderId!])
      expect(error, error?.message).toBeNull()
      expect((data as any[]).map((r) => r.id), `typed ${JSON.stringify(typed)}`).toEqual([fx!.pendingOrderId])
    }
  })

  it('normalised lookup finds the GV- order the same way', async () => {
    for (const typed of ['gv-123456', 'GV123456', 'gv 123 456', '#GV-123456']) {
      const { data, error } = await fx!.svc.from('orders').select('id')
        .ilike('order_number_search', orderNumberSearchPattern(typed))
        .in('id', [fx!.pendingOrderId, fx!.completedOrderId, legacyOrderId!])
      expect(error, error?.message).toBeNull()
      expect((data as any[]).map((r) => r.id), `typed ${JSON.stringify(typed)}`).toEqual([legacyOrderId])
    }
  })

  it('a partial number matches as a contains search; a symbol-only query matches nothing', async () => {
    const { data: part } = await fx!.svc.from('orders').select('id')
      .ilike('order_number_search', orderNumberSearchPattern('1234'))
      .in('id', [fx!.pendingOrderId, fx!.completedOrderId, legacyOrderId!])
    expect((part as any[]).map((r) => r.id)).toEqual([legacyOrderId])
    const { data: none, error } = await fx!.svc.from('orders').select('id')
      .ilike('order_number_search', orderNumberSearchPattern('---'))
      .in('id', [fx!.pendingOrderId, fx!.completedOrderId, legacyOrderId!])
    expect(error, error?.message).toBeNull()
    expect(none).toEqual([])
  })
})
