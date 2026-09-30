/**
 * Refund to the original payment method (docs/design/buyer-fee-refund-policy.md):
 *   · a buyer whose refund sits as store credit can request it back to the
 *     paid rail — once per order, only while the credit is unspent, only on
 *     a refundable rail with a provider charge;
 *   · approve = ONE RPC: the credit leaves user_wallet → provider_float and
 *     an outbox row kind='refund' is queued; the drain calls provider.refund
 *     and marks the request sent;
 *   · at the retry cap the mark reverses the credit, marks failed and alerts
 *     admins once;
 *   · the new RPCs are service-role only.
 * Every row it creates is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await (fx!.svc.rpc as any)(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as any
}
const wallet = async (uid: string) => BigInt((await rpc('user_wallet_balance', { p_user_id: uid, p_currency: CUR })) ?? 0)
const request = async (orderId: string) => (await fx!.svc.from('refund_to_source_requests').select('*').eq('order_id', orderId).maybeSingle()).data as any
const outboxRows = async (orderId: string) => ((await fx!.svc.from('provider_cancel_outbox').select('*').eq('order_id', orderId).eq('kind', 'refund')).data ?? []) as any[]

/** A PAID $20 Pix (Payssion) order for the admin actor, refunded in full as store credit. */
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
    expect(Number(first.amount_minor)).toBe(2325) // $20 + $0.40 marketplace + $2.85 Pix processing
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
    expect(before - (await wallet(fx!.admin.id))).toBe(BigInt(req.amount_minor))
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
    expect(before - (await wallet(fx!.admin.id))).toBe(BigInt(req.amount_minor))
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
    expect(await wallet(fx!.admin.id)).toBe(before)
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

  it('the refund-to-source RPCs are service-role only', async () => {
    for (const [fn, args] of [
      ['refund_to_source_request', { p_order_id: made[0], p_buyer_id: fx!.buyer.id }],
      ['refund_to_source_approve', { p_request_id: made[0], p_admin_id: fx!.buyer.id }],
      ['refund_to_source_reject', { p_request_id: made[0], p_admin_id: fx!.buyer.id, p_notes: null }],
      ['refund_to_source_fail', { p_request_id: made[0], p_error: 'x' }],
    ] as const) {
      const { error } = await (fx!.buyer.client.rpc as any)(fn, args)
      expect(error?.code, fn).toBe('42501')
    }
    const { error } = await fx!.buyer.client.from('refund_to_source_requests').select('id').limit(1)
    expect(error?.code).toBe('42501')
  })
})
