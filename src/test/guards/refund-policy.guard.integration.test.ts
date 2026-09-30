/**
 * Refund policy (docs/design/buyer-fee-refund-policy.md, 2026-09-30):
 *   · buyer fault  → the item price is credited, the fees the buyer paid move
 *                    refunds → platform_commission (fee_kept:<order>);
 *   · seller fault → full credit + a row in order_seller_faults; from the
 *                    seller's 5th fault in 7 days that order's buyer fees are
 *                    charged to seller_available (seller_fault_fee:<order>);
 *   · platform (default) → full credit, nothing recorded — every caller not
 *                    passing a fault keeps today's behaviour;
 *   · a replay credits nothing twice; a fault inside the leg leaves no
 *     partial state; buyers are refused by the withdrawal gate.
 *
 * Runs against this worktree's local stack. Every order it creates goes
 * through order_create_pending + order_confirm_payment (a fake charge) and
 * is removed with its ledger rows in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

vi.mock('@/lib/email', () => ({}))

let fx: Fixture | null = null
const CUR = 'USD'
const made: string[] = []
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itFault = it.skipIf(!TARGET_IS_LOCAL)

function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await (fx!.svc.rpc as any)(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as any
}
const wallet = async (uid: string) => BigInt((await rpc('user_wallet_balance', { p_user_id: uid, p_currency: CUR })) ?? 0)
const sellerAvail = async (uid: string) => BigInt((await rpc('seller_available_balance', { p_seller_id: uid, p_currency: CUR })) ?? 0)
const txn = async (key: string) => (await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()).data
const faultRow = async (orderId: string) =>
  (await fx!.svc.from('order_seller_faults').select('order_id, source, fee_charged_minor').eq('order_id', orderId).maybeSingle()).data as any

/**
 * A PAID $20 crypto order for the fixture buyer: subtotal 2000, marketplace
 * 40, processing 102, total 2142, escrow held. Buyer = the admin actor when
 * the fixture buyer already holds a pending order on the listing.
 */
async function paidOrder(buyerId = fx!.admin.id): Promise<string> {
  const data = await rpc('order_create_pending', {
    p_buyer_id: buyerId, p_seller_id: fx!.seller.id, p_listing_id: fx!.listingId, p_quantity: 1,
    p_unit_price: 20, p_subtotal: 20, p_platform_fee_rate: 0, p_platform_fee: 0, p_seller_payout: 18,
    p_seller_commission_pct: 10, p_seller_fee_trace: {}, p_currency: CUR, p_promo_code_id: null, p_promo_discount: 0,
    p_wallet_minor: 0, p_provider: 'btcpay', p_pm_id: null, p_fallback_expires_at: new Date(Date.now() + 3600e3).toISOString(),
    p_buyer_fee_method: 'btcpay',
  })
  const id = data.order_id as string
  made.push(id)
  const confirmed = await rpc('order_confirm_payment', {
    p_order_id: id, p_dedupe_key: `test:refund-policy:${id}`, p_provider: 'btcpay', p_provider_charge_id: `chg_${id}`,
    p_amount_minor: 2142, p_paid_minor: 2142, p_currency: CUR,
  })
  if (confirmed?.outcome && confirmed.outcome !== 'paid') throw new Error(`confirm outcome ${confirmed.outcome}`)
  return id
}

describe.skipIf(!hasEnv)('refund policy — fault-aware buyer credits (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of made) {
      await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
      await fx.svc.from('order_seller_faults').delete().eq('order_id', id)
      await fx.svc.from('notifications').delete().like('link', `%${id}%`)
      await fx.svc.from('payment_attempts').delete().eq('order_id', id)
      await fx.svc.from('orders').delete().eq('id', id)
    }
    await fx.svc.from('notifications').delete().eq('user_id', fx.seller.id).eq('type', 'seller_fault_fee')
    await fx.cleanup()
  }, 120_000)

  it('the migration is applied: platform_fee_settings carries the fault-fee terms', async () => {
    const { data } = await fx!.svc.from('platform_fee_settings').select('seller_fault_fee_threshold, seller_fault_fee_window_days').single()
    expect(Number((data as any).seller_fault_fee_threshold)).toBe(5)
    expect(Number((data as any).seller_fault_fee_window_days)).toBe(7)
  })

  it('buyer fault (cancel of a paid order): the item price is credited, the fees move to platform_commission', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.admin.id)
    const r = await rpc('order_cancel_return_wallet', { p_order_id: id, p_dedupe_key: 'buyer', p_allow_paid: true, p_attempt_close: 'void', p_fault: 'buyer' })
    expect(r.changed).toBe(true)
    expect(r.from_paid).toBe(true)
    expect(Number(r.credited_minor)).toBe(2000)
    expect(Number(r.fee_kept_minor)).toBe(142)
    expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
    expect(await txn(`wallet_refund:${id}`)).not.toBeNull()
    expect(await txn(`fee_kept:${id}`)).not.toBeNull()
    expect(await faultRow(id)).toBeNull()
    const { data: o } = await fx!.svc.from('orders').select('status').eq('id', id).single()
    expect((o as any).status).toBe('cancelled')
  })

  it('buyer fault through order_refund_to_wallet behaves the same (item price, fee kept)', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.admin.id)
    const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'b', p_fault: 'buyer' })
    expect(Number(r.credited_minor)).toBe(2000)
    expect(Number(r.fee_kept_minor)).toBe(142)
    expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
  })

  it('default (platform) fault: full credit, nothing kept, no fault row — old callers unchanged', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.admin.id)
    const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'plat' })
    expect(r.fault).toBe('platform')
    expect(Number(r.credited_minor)).toBe(2142)
    expect(Number(r.fee_kept_minor)).toBe(0)
    expect((await wallet(fx!.admin.id)) - before).toBe(2142n)
    expect(await txn(`fee_kept:${id}`)).toBeNull()
    expect(await faultRow(id)).toBeNull()
  })

  it('seller fault: full credit and a fault row; faults 1–4 in the window charge the seller nothing', async () => {
    const before = await wallet(fx!.admin.id)
    const availBefore = await sellerAvail(fx!.seller.id)
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push(await paidOrder())
    for (const id of ids) {
      const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'seller_cancel:' + id, p_fault: 'seller' })
      expect(Number(r.credited_minor)).toBe(2142)
      expect(Number(r.fault_fee_minor)).toBe(0)
      const f = await faultRow(id)
      expect(f?.source).toBe('seller_cancel')
      expect(Number(f?.fee_charged_minor)).toBe(0)
    }
    expect((await wallet(fx!.admin.id)) - before).toBe(4n * 2142n)
    expect(await sellerAvail(fx!.seller.id)).toBe(availBefore)
    const r4 = await rpc('order_refund_buyer_credit', { p_order_id: ids[3], p_fault: 'seller', p_amount_minor: null })
    // replay of the leg on an already-recorded order: idempotent, no second row
    expect(Number(r4.fault_fee_minor)).toBe(0)
  })

  it('the 5th seller fault in 7 days charges that order’s buyer fees ($1.42) to seller_available and notifies the seller', async () => {
    const id = await paidOrder()
    const availBefore = await sellerAvail(fx!.seller.id)
    const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'cancel_request:' + id, p_fault: 'seller' })
    expect(Number(r.credited_minor)).toBe(2142)
    expect(Number(r.fault_count_in_window)).toBeGreaterThanOrEqual(5)
    expect(Number(r.fault_fee_minor)).toBe(142)
    expect(availBefore - (await sellerAvail(fx!.seller.id))).toBe(142n)
    expect(await txn(`seller_fault_fee:${id}`)).not.toBeNull()
    const f = await faultRow(id)
    expect(f?.source).toBe('admin_cancel')
    expect(Number(f?.fee_charged_minor)).toBe(142)
    const { data: n } = await fx!.svc.from('notifications').select('title').eq('user_id', fx!.seller.id).eq('type', 'seller_fault_fee').like('link', `%${id}%`).maybeSingle()
    expect((n as any)?.title).toBe('Non-Delivery Fee Applied')
  })

  it('replaying a refund credits nothing twice and reports changed=false', async () => {
    const id = await paidOrder()
    await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'once', p_fault: 'buyer' })
    const before = await wallet(fx!.admin.id)
    const again = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'once', p_fault: 'buyer' })
    expect(again.changed).toBe(false)
    expect(again.reason).toBe('already_refunded')
    expect(await wallet(fx!.admin.id)).toBe(before)
    // a provider "refunded" webhook for a cancelled order is the same no-op
    const id2 = await paidOrder()
    await rpc('order_cancel_return_wallet', { p_order_id: id2, p_dedupe_key: 'c', p_allow_paid: true, p_attempt_close: 'void', p_fault: 'buyer' })
    const before2 = await wallet(fx!.admin.id)
    const webhook = await rpc('order_refund_to_wallet', { p_order_id: id2, p_dedupe_key: 'evt:1', p_amount_minor: 2142 })
    expect(webhook.changed).toBe(false)
    expect(await wallet(fx!.admin.id)).toBe(before2)
  })

  it('an explicit provider amount (partial refund) wins over the fault rule and is clamped to the total', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.admin.id)
    const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'p', p_amount_minor: 500, p_fault: 'buyer' })
    expect(Number(r.credited_minor)).toBe(500)
    expect((await wallet(fx!.admin.id)) - before).toBe(500n)
  })

  itFault('a fault inside the credit leg rolls the whole refund back: order still paid, no credit, no fee kept', async () => {
    const id = await paidOrder()
    const before = await wallet(fx!.admin.id)
    const err = withFault('order_refund_buyer_credit:after_credit', `SELECT order_refund_to_wallet('${id}'::uuid, 'f', NULL, 'buyer')`)
    expect(err).toMatch(/money_fault_hook|order_refund_buyer_credit:after_credit/)
    const { data: o } = await fx!.svc.from('orders').select('status').eq('id', id).single()
    expect((o as any).status).toBe('paid')
    expect(await wallet(fx!.admin.id)).toBe(before)
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
    expect(await txn(`fee_kept:${id}`)).toBeNull()
  })

  it('the withdrawal gate refuses a buyer account: not_a_seller, with support copy from withdrawal_quote', async () => {
    const gate = await rpc('seller_withdrawal_gate', { p_seller_id: fx!.buyer.id })
    expect(gate.eligible).toBe(false)
    expect(gate.reason).toBe('not_a_seller')
    const { data: m } = await fx!.svc.from('withdrawal_methods').select('id').eq('is_active', true).limit(1).maybeSingle()
    if (m) {
      const q = await rpc('withdrawal_quote', { p_seller_id: fx!.buyer.id, p_method_id: (m as any).id, p_amount: 50 })
      expect(q.ok).toBe(false)
      expect(q.refusal).toBe('not_a_seller')
      expect(q.message).toMatch(/contact support@dropmarket\.gg/)
    }
  })

  it('the new functions are service-role only', async () => {
    for (const [fn, args] of [
      ['order_refund_buyer_credit', { p_order_id: made[0], p_fault: 'buyer', p_amount_minor: null }],
      ['order_seller_fault_record', { p_order_id: made[0], p_source: 'seller_cancel' }],
    ] as const) {
      const { error } = await (fx!.buyer.client.rpc as any)(fn, args)
      expect(error?.code, fn).toBe('42501')
    }
  })
})
