/**
 * Refund to the original payment method (docs/design/buyer-fee-refund-policy.md):
 *   · a buyer whose refund sits as store credit (the item price) can request
 *     it back to the paid rail for the FULL amount — store credit + the kept
 *     service fee (2026-10-16) — once per order, only while the credit is
 *     unspent, only on a refundable rail with a provider charge;
 *   · approve = ONE RPC: the credit leaves user_wallet → provider_float, the
 *     kept fee leaves platform_commission → provider_float, and an outbox row
 *     kind='refund' for the full amount is queued; the drain calls
 *     provider.refund, marks the request sent and charges a due seller fee;
 *   · at the retry cap the mark reverses both legs, marks failed and alerts
 *     admins once;
 *   · the new RPCs are service-role only.
 * Every row it creates is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

vi.mock('@/lib/email', () => ({}))
vi.mock('server-only', () => ({}))
const refundMode = { throw: false }
vi.mock('@/lib/payments/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/payments/registry')>()
  const { fakeProvider } = await import('@/lib/payments/providers/fake')
  return {
    ...real,
    getProvider: (name: string) => ({
      ...fakeProvider,
      name,
      async refund(chargeId: string) {
        if (refundMode.throw) throw new Error('fake: refund endpoint down')
        return { refundId: `refund_${chargeId}` }
      },
    }),
  }
})

let fx: Fixture | null = null
const CUR = 'USD'
const made: string[] = []
const tag = () => Math.random().toString(36).slice(2, 8)
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const itFault = it.skipIf(!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost))
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
const request = async (orderId: string) => (await fx!.svc.from('refund_to_source_requests').select('*').eq('order_id', orderId).maybeSingle()).data as any
const txn = async (key: string) => (await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()).data
const sellerAvail = async (uid: string) => BigInt((await rpc('seller_available_balance', { p_seller_id: uid, p_currency: CUR })) ?? 0)
const outboxRows = async (orderId: string) => ((await fx!.svc.from('provider_cancel_outbox').select('*').eq('order_id', orderId).eq('kind', 'refund')).data ?? []) as any[]

/** A PAID $20 Pix (Payssion) order for the admin actor, refunded (seller fault) as $20 store credit; $3.25 fees kept. */
async function refundedOrder(): Promise<string> {
  const data = await rpc('order_create_pending', {
    p_buyer_id: fx!.admin.id, p_seller_id: fx!.seller.id, p_listing_id: fx!.listingId, p_quantity: 1,
    p_unit_price: 20, p_subtotal: 20, p_platform_fee_rate: 0, p_platform_fee: 0, p_seller_payout: 18,
    p_seller_commission_pct: 10, p_seller_fee_trace: {}, p_currency: CUR, p_promo_code_id: null, p_promo_discount: 0,
    p_wallet_minor: 0, p_provider: 'payssion', p_pm_id: 'pix_br', p_fallback_expires_at: new Date(Date.now() + 3600e3).toISOString(),
    p_buyer_fee_method: 'pix_br',
  })
  const id = data.order_id as string
  made.push(id)
  const total = Number(data.total_minor)
  // What createCharge → payment_attempt_activate does for a real order: the
  // attempt carries the provider's charge id before the payment lands.
  const { error: bindErr } = await fx!.svc
    .from('payment_attempts')
    .update({ provider_charge_id: `pay_${id}`, status: 'active', checkout_url: 'https://sandbox.example/pay' } as any)
    .eq('order_id', id)
  if (bindErr) throw new Error(`bind charge: ${bindErr.message}`)
  await rpc('order_confirm_payment', {
    p_order_id: id, p_dedupe_key: `test:rts:${id}`, p_provider: 'payssion', p_provider_charge_id: `pay_${id}`,
    p_amount_minor: total, p_paid_minor: total, p_currency: CUR,
  })
  const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'seller_cancel:' + id, p_fault: 'seller' })
  if (!r.changed) throw new Error('refund did not apply')
  return id
}

describe.skipIf(!hasEnv)('refund to source — request → approve → provider refund (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of made) {
      await fx.svc.from('provider_cancel_outbox').delete().eq('order_id', id)
      await fx.svc.from('refund_to_source_requests').delete().eq('order_id', id)
      await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
      await fx.svc.from('order_seller_faults').delete().eq('order_id', id)
      await fx.svc.from('notifications').delete().like('link', `%${id}%`)
      await fx.svc.from('payment_attempts').delete().eq('order_id', id)
      await fx.svc.from('orders').delete().eq('id', id)
    }
    await fx.svc.rpc('ledger_test_cleanup' as any, { p_prefix: 'test:ledger:rts:%' })
    await fx.cleanup()
  }, 120_000)

  it('the paid attempt carries the provider charge the request will refund', async () => {
    const id = await refundedOrder()
    const { data: att } = await fx!.svc.from('payment_attempts').select('status, provider, provider_charge_id, pm_id').eq('order_id', id).single()
    expect((att as any).status).toBe('paid')
    expect((att as any).provider).toBe('payssion')
    expect((att as any).provider_charge_id).toBe(`pay_${id}`)
  })

  it('request: pending once, then exists; the credited amount is the request amount', async () => {
    const id = await refundedOrder()
    const first = await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    expect(first.ok).toBe(true)
    // the full amount paid: $20 store credit + $0.40 marketplace + $2.85 Pix processing
    expect(Number(first.amount_minor)).toBe(2325)
    expect(Number(first.credit_minor)).toBe(2000)
    expect(Number(first.fee_minor)).toBe(325)
    expect(Number((await request(id)).fee_minor)).toBe(325)
    const again = await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('exists')
    const stranger = await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    expect(stranger.reason).toBe('not_owner')
    expect((await request(id)).status).toBe('pending')
  })

  it('request is refused when the credit was already spent', async () => {
    const id = await refundedOrder()
    const bal = await wallet(fx!.admin.id)
    await rpc('wallet_spend', {
      p_user_id: fx!.admin.id, p_amount_minor: (bal - 100n).toString(), p_currency: CUR, p_target: 'escrow_held',
      p_idempotency_key: `test:ledger:rts:spend:${tag()}`, p_event_ref: 'TEST_SPEND', p_order_id: null,
    })
    const r = await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('credit_spent')
    // put it back for the tests below
    await rpc('wallet_credit', {
      p_user_id: fx!.admin.id, p_amount_minor: (bal - 100n).toString(), p_currency: CUR, p_counterparty: 'escrow_held',
      p_idempotency_key: `test:ledger:rts:refill:${tag()}`, p_event_ref: 'TEST_REFILL', p_order_id: null,
    })
  })

  it('approve: the credit leaves the wallet, an outbox refund row is queued, the drain sends it and marks the request sent', async () => {
    const id = await refundedOrder()
    await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    const before = await wallet(fx!.admin.id)
    const req = await request(id)
    const approved = await rpc('refund_to_source_approve', { p_request_id: req.id, p_admin_id: fx!.admin.id })
    expect(approved.approved).toBe(true)
    // only the store credit leaves the wallet; the kept fee comes from platform_commission
    expect(before - (await wallet(fx!.admin.id))).toBe(BigInt(req.amount_minor) - BigInt(req.fee_minor))
    expect(before - (await wallet(fx!.admin.id))).toBe(2000n)
    expect(await txn(`refund_to_source_fee:${req.id}`)).not.toBeNull()
    const rows = await outboxRows(id)
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('pending')
    expect(Number(rows[0].amount_minor)).toBe(Number(req.amount_minor))
    expect(rows[0].request_id).toBe(req.id)
    expect((await request(id)).status).toBe('approved')
    // replay of approve is refused, nothing moves twice
    const twice = await rpc('refund_to_source_approve', { p_request_id: req.id, p_admin_id: fx!.admin.id })
    expect(twice.approved).toBe(false)
    expect(twice.reason).toBe('not_pending')

    const { drainProviderCancelOutbox } = await import('@/lib/payments/cancel-outbox')
    const summary = await drainProviderCancelOutbox({ orderId: id })
    expect(summary.done).toBe(1)
    const after = await request(id)
    expect(after.status).toBe('sent')
    expect(after.provider_refund_id).toBe(`refund_pay_${id}`)
    expect((await outboxRows(id))[0].status).toBe('done')
  })

  it('a provider that keeps failing: at the retry cap the credit is reversed, the request fails and admins are alerted once', async () => {
    const id = await refundedOrder()
    await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    const req = await request(id)
    const before = await wallet(fx!.admin.id)
    await rpc('refund_to_source_approve', { p_request_id: req.id, p_admin_id: fx!.admin.id })
    expect(before - (await wallet(fx!.admin.id))).toBe(2000n)
    // Fast-forward the row to its last allowed attempt.
    await fx!.svc.from('provider_cancel_outbox').update({ attempts: 5, next_attempt_at: new Date(Date.now() - 1000).toISOString() } as any).eq('request_id', req.id)
    refundMode.throw = true
    try {
      const { drainProviderCancelOutbox } = await import('@/lib/payments/cancel-outbox')
      const summary = await drainProviderCancelOutbox({ orderId: id })
      expect(summary.failed).toBe(1)
    } finally {
      refundMode.throw = false
    }
    const after = await request(id)
    expect(after.status).toBe('failed')
    expect(after.failure_reason).toMatch(/refund endpoint down/)
    // both legs reversed: the $20 store credit is back, the fee is back with the platform
    expect(await wallet(fx!.admin.id)).toBe(before)
    expect(await txn(`refund_to_source_fee_reversal:${req.id}`)).not.toBeNull()
    expect(await txn(`seller_fault_fee:${id}`)).toBeNull()
    // admin_alert_once: one in-app notification per active admin (the
    // fixture admin), deduped on (type, title, link).
    const { data: alerts } = await fx!.svc.from('notifications').select('id, user_id').eq('type', 'payment_review').eq('title', 'Refund To Source Failed').like('link', `%${id}%`)
    expect((alerts ?? []).length).toBe(1)
    expect((alerts as any[])[0].user_id).toBe(fx!.admin.id)
    expect((await outboxRows(id))[0].status).toBe('failed')
  })

  it('reject: the request closes and the credit stays', async () => {
    const id = await refundedOrder()
    await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    const req = await request(id)
    const before = await wallet(fx!.admin.id)
    const r = await rpc('refund_to_source_reject', { p_request_id: req.id, p_admin_id: fx!.admin.id, p_notes: 'Rail needs KYC' })
    expect(r.rejected).toBe(true)
    expect((await request(id)).status).toBe('rejected')
    expect(await wallet(fx!.admin.id)).toBe(before)
  })

  it('the provider’s own refunded webhook after a sent refund is a no-op on the order', async () => {
    const id = await refundedOrder()
    const before = await wallet(fx!.admin.id)
    const r = await rpc('order_refund_to_wallet', { p_order_id: id, p_dedupe_key: 'evt:refunded', p_amount_minor: 2325 })
    expect(r.changed).toBe(false)
    expect(r.reason).toBe('already_refunded')
    expect(await wallet(fx!.admin.id)).toBe(before)
  })

  it('quotes: every refunded order lists its store credit, kept fee and full card amount', async () => {
    const id = await refundedOrder()
    const rows = (await rpc('refund_to_source_quotes', { p_buyer_id: fx!.admin.id })) as any[]
    const row = rows.find((r) => r.order_id === id)
    expect(row).toBeTruthy()
    expect(Number(row.credit_minor)).toBe(2000)
    expect(Number(row.fee_minor)).toBe(325)
    expect(Number(row.total_minor)).toBe(2325)
    expect(row.refundable).toBe(true)
    expect(row.request_status).toBeNull()
    const stranger = (await rpc('refund_to_source_quotes', { p_buyer_id: fx!.buyer.id })) as any[]
    expect(stranger.find((r) => r.order_id === id)).toBeUndefined()
  })

  it('crypto rails cannot refund provider-side: btcpay and coingate are store credit only', async () => {
    const { data } = await fx!.svc.from('payment_method_fees').select('method, refundable').in('method', ['btcpay', 'coingate'])
    expect((data ?? []).length).toBe(2)
    for (const r of data as any[]) expect(r.refundable, r.method).toBe(false)
  })

  it('a SENT card refund on an order with a due seller fee charges the seller once', async () => {
    // This file's earlier orders are all seller faults for the same fixture
    // seller inside the window, so this one is past the threshold.
    const id = await refundedOrder()
    const { data: f } = await fx!.svc.from('order_seller_faults').select('fee_due_minor, fee_charged_minor').eq('order_id', id).single()
    expect(Number((f as any).fee_due_minor)).toBe(325)
    expect(Number((f as any).fee_charged_minor)).toBe(0)
    await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    const req = await request(id)
    const availBefore = await sellerAvail(fx!.seller.id)
    await rpc('refund_to_source_approve', { p_request_id: req.id, p_admin_id: fx!.admin.id })
    // approved but not sent yet: nothing charged
    expect(await txn(`seller_fault_fee:${id}`)).toBeNull()
    const { drainProviderCancelOutbox } = await import('@/lib/payments/cancel-outbox')
    expect((await drainProviderCancelOutbox({ orderId: id })).done).toBe(1)
    expect((await request(id)).status).toBe('sent')
    expect(await txn(`seller_fault_fee:${id}`)).not.toBeNull()
    expect(availBefore - (await sellerAvail(fx!.seller.id))).toBe(325n)
    const again = await rpc('order_seller_fault_charge', { p_order_id: id })
    expect(again.charged).toBe(false)
  })

  itFault('a fault after the fee leg rolls approve back: credit unspent, no fee paid out, no outbox row', async () => {
    const id = await refundedOrder()
    await rpc('refund_to_source_request', { p_order_id: id, p_buyer_id: fx!.admin.id })
    const req = await request(id)
    const before = await wallet(fx!.admin.id)
    const err = withFault('refund_to_source_approve:after_fee', `SELECT refund_to_source_approve('${req.id}'::uuid, '${fx!.admin.id}'::uuid)`)
    expect(err).toMatch(/money_fault_hook|refund_to_source_approve:after_fee/)
    expect(await wallet(fx!.admin.id)).toBe(before)
    expect(await txn(`refund_to_source:${req.id}`)).toBeNull()
    expect(await txn(`refund_to_source_fee:${req.id}`)).toBeNull()
    expect((await outboxRows(id)).length).toBe(0)
    expect((await request(id)).status).toBe('pending')
  })

  it('the refund-to-source RPCs are service-role only', async () => {
    for (const [fn, args] of [
      ['refund_to_source_request', { p_order_id: made[0], p_buyer_id: fx!.buyer.id }],
      ['refund_to_source_approve', { p_request_id: made[0], p_admin_id: fx!.buyer.id }],
      ['refund_to_source_reject', { p_request_id: made[0], p_admin_id: fx!.buyer.id, p_notes: null }],
      ['refund_to_source_fail', { p_request_id: made[0], p_error: 'x' }],
      ['refund_to_source_quotes', { p_buyer_id: fx!.buyer.id }],
    ] as const) {
      const { error } = await (fx!.buyer.client.rpc as any)(fn, args)
      expect(error?.code, fn).toBe('42501')
    }
    const { error } = await fx!.buyer.client.from('refund_to_source_requests').select('id').limit(1)
    expect(error?.code).toBe('42501')
  })
})
