/**
 * "Cancel – Not Delivered" with admin review (owner 2026-10-16/19/20; plan
 * docs/superpowers/plans/2026-10-16-not-delivered-cancel-and-refund-rule.md):
 *   · once a paid order's delivery time has passed the buyer can report it;
 *     the seller is notified and has a response window = the listing's
 *     delivery time, clamped to 15 minutes .. 24 hours;
 *   · a seller chat reply or Start delivery inside the window closes the
 *     report (the order stays open); buyer messages and system notices don't
 *     count; a delivery or seller cancel closes it too;
 *   · NOTHING cancels automatically: when the window runs out with no
 *     response the report becomes `expired` (buyer + seller told), and the
 *     buyer can request cancellation — a normal order_cancellation_requests
 *     row an admin reviews, with an alert to every active admin;
 *   · the seller can still deliver until the admin acts; delivery closes the
 *     report and the pending request;
 *   · no function here moves money.
 * Every row it creates is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

vi.mock('@/lib/email', () => ({}))

let fx: Fixture | null = null
const CUR = 'USD'
const made: string[] = []

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await (fx!.svc.rpc as any)(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as any
}
const wallet = async (uid: string) => BigInt((await rpc('user_wallet_balance', { p_user_id: uid, p_currency: CUR })) ?? 0)
const txn = async (key: string) => (await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()).data
const claim = async (orderId: string) =>
  (await fx!.svc.from('order_not_delivered_claims' as any).select('*').eq('order_id', orderId).maybeSingle()).data as any
const requestRow = async (id: string) =>
  (await fx!.svc.from('order_cancellation_requests').select('*').eq('id', id).maybeSingle()).data as any
const orderStatus = async (id: string) =>
  ((await fx!.svc.from('orders').select('status').eq('id', id).single()).data as any).status as string
const notes = async (userId: string, orderId: string) =>
  (((await fx!.svc.from('notifications').select('type, title, message').eq('user_id', userId).like('link', `%${orderId}%`)).data ?? []) as any[])
const past = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
/** Fast-forward a report past the end of its response window. */
const ageClaim = async (orderId: string) => {
  const { error } = await (fx!.svc.from('order_not_delivered_claims' as any).update as any)({ grace_ends_at: past(1), opened_at: past(30) }).eq('order_id', orderId)
  if (error) throw new Error(`age claim: ${error.message}`)
}
const open = (orderId: string, windowMinutes = 20) =>
  rpc('order_not_delivered_open', { p_order_id: orderId, p_buyer_id: fx!.admin.id, p_due_at: past(5), p_window_minutes: windowMinutes })
const sync = (orderId: string) => rpc('order_not_delivered_sync', { p_order_id: orderId })
const requestCancel = (orderId: string, buyerId = fx!.admin.id) =>
  rpc('order_not_delivered_request_cancel', { p_order_id: orderId, p_buyer_id: buyerId, p_note: 'Seller went quiet' })

/** The order's chat (created if the fixture has none) + one message from `senderId`. */
async function say(orderId: string, senderId: string | null) {
  let { data: cv } = (await fx!.svc.from('conversations').select('id').eq('order_id', orderId).maybeSingle()) as any
  if (!cv) {
    const { data, error } = await (fx!.svc.from('conversations').insert as any)({
      order_id: orderId, buyer_id: fx!.admin.id, seller_id: fx!.seller.id, listing_id: fx!.listingId,
    }).select('id').single()
    if (error) throw new Error(`conversation: ${error.message}`)
    cv = data
  }
  // A system notice (sender NULL) must carry a JSON notice body (messages_system_notice_shape).
  const content = senderId === null ? JSON.stringify({ type: 'order_delivered', seller: 'test' }) : 'on it'
  const { error } = await (fx!.svc.from('messages').insert as any)({ conversation_id: cv.id, sender_id: senderId, content })
  if (error) throw new Error(`message: ${error.message}`)
  return cv.id as string
}

/** A PAID $20 crypto order (subtotal 2000, fees 142, total 2142) for the admin actor. */
async function paidOrder(): Promise<string> {
  const data = await rpc('order_create_pending', {
    p_buyer_id: fx!.admin.id, p_seller_id: fx!.seller.id, p_listing_id: fx!.listingId, p_quantity: 1,
    p_unit_price: 20, p_subtotal: 20, p_platform_fee_rate: 0, p_platform_fee: 0, p_seller_payout: 18,
    p_seller_commission_pct: 10, p_seller_fee_trace: {}, p_currency: CUR, p_promo_code_id: null, p_promo_discount: 0,
    p_wallet_minor: 0, p_provider: 'btcpay', p_pm_id: null, p_fallback_expires_at: new Date(Date.now() + 3600e3).toISOString(),
    p_buyer_fee_method: 'btcpay',
  })
  const id = data.order_id as string
  made.push(id)
  const confirmed = await rpc('order_confirm_payment', {
    p_order_id: id, p_dedupe_key: `test:not-delivered:${id}`, p_provider: 'btcpay', p_provider_charge_id: `chg_${id}`,
    p_amount_minor: 2142, p_paid_minor: 2142, p_currency: CUR,
  })
  if (confirmed?.outcome && confirmed.outcome !== 'paid') throw new Error(`confirm outcome ${confirmed.outcome}`)
  return id
}

describe.skipIf(!hasEnv)('Cancel – Not Delivered — response window, then admin-reviewed cancellation (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    // Every case buys the fixture listing once; the fixture ships 5 in stock.
    const { error } = await fx.svc.from('listings').update({ quantity: 100 } as any).eq('id', fx.listingId)
    if (error) throw new Error(`listing stock: ${error.message}`)
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of made) {
      const { data: cvs } = (await fx.svc.from('conversations').select('id').eq('order_id', id)) as any
      for (const cv of cvs ?? []) await fx.svc.from('messages').delete().eq('conversation_id', cv.id)
      await fx.svc.from('conversations').delete().eq('order_id', id)
      await fx.svc.from('order_not_delivered_claims' as any).delete().eq('order_id', id)
      await fx.svc.from('order_cancellation_requests').delete().eq('order_id', id)
      await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
      await fx.svc.from('order_seller_faults').delete().eq('order_id', id)
      await fx.svc.from('notifications').delete().like('link', `%${id}%`)
      await fx.svc.from('payment_attempts').delete().eq('order_id', id)
      await fx.svc.from('orders').delete().eq('id', id)
    }
    // The admin alerts link to the admin list, not the order: remove them by title.
    await fx.svc.from('notifications').delete().eq('type', 'order_review').like('title', 'Cancellation Request — Not Delivered%')
    await fx.cleanup()
  }, 120_000)

  it('the fixed 60-minute setting is gone', async () => {
    const { error } = await fx!.svc.from('platform_fee_settings').select('not_delivered_grace_minutes' as any).limit(1)
    expect(error).not.toBeNull()
  })

  it('the response window is the delivery time, clamped to 15 minutes .. 24 hours', async () => {
    for (const [asked, expected] of [[20, 20], [5, 15], [5000, 1440]] as const) {
      const id = await paidOrder()
      const r = await open(id, asked)
      expect(r.ok).toBe(true)
      expect(Number(r.window_minutes)).toBe(expected)
      const mins = (Date.parse(r.grace_ends_at) - Date.now()) / 60_000
      expect(mins).toBeGreaterThan(expected - 2)
      expect(mins).toBeLessThanOrEqual(expected)
      expect(Number((await claim(id)).window_minutes)).toBe(expected)
    }
  })

  it('open is refused before the delivery time passes and for someone else’s order', async () => {
    const id = await paidOrder()
    const early = await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: new Date(Date.now() + 60_000).toISOString(), p_window_minutes: 20 })
    expect(early).toMatchObject({ ok: false, reason: 'not_overdue' })
    const stranger = await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.seller.id, p_due_at: past(5), p_window_minutes: 20 })
    expect(stranger).toMatchObject({ ok: false, reason: 'not_owner' })
    expect(await claim(id)).toBeNull()
  })

  it('open notifies the seller once with the window; a second open is a no-op', async () => {
    const id = await paidOrder()
    expect(await open(id, 20)).toMatchObject({ ok: true, already: false })
    expect(await open(id, 20)).toMatchObject({ ok: true, already: true })
    const sellerNotes = (await notes(fx!.seller.id, id)).filter((n) => n.type === 'order_not_delivered')
    expect(sellerNotes.length).toBe(1)
    expect(sellerNotes[0].message).toMatch(/within 20 minutes/)
  })

  it('inside the window sync changes nothing', async () => {
    const id = await paidOrder()
    await open(id)
    expect(await sync(id)).toMatchObject({ synced: false, reason: 'window' })
    expect((await claim(id)).status).toBe('open')
  })

  it('no response by the end of the window → expired, both told, NO money moves and the order stays paid', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    const before = await wallet(fx!.admin.id)
    expect(await sync(id)).toMatchObject({ synced: true, outcome: 'expired' })
    expect((await claim(id)).status).toBe('expired')
    expect(await orderStatus(id)).toBe('paid')
    expect(await wallet(fx!.admin.id)).toBe(before)
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
    expect((await notes(fx!.admin.id, id)).map((n) => n.title)).toContain('Seller Did Not Respond')
    expect((await notes(fx!.seller.id, id)).map((n) => n.title)).toContain('Deliver Now To Keep The Order')
    // replay: no second notice, no change
    expect(await sync(id)).toMatchObject({ synced: false })
  })

  it('a delivery inside the window closes the report', async () => {
    const id = await paidOrder()
    await open(id)
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    expect(await sync(id)).toMatchObject({ synced: true, outcome: 'delivered' })
    expect((await claim(id)).status).toBe('delivered')
  })

  it('a seller chat reply inside the window closes the report at once', async () => {
    const id = await paidOrder()
    await open(id)
    await say(id, fx!.seller.id)
    const c = await claim(id)
    expect(c.status).toBe('seller_responded')
    expect(c.response_kind).toBe('message')
    expect((await notes(fx!.admin.id, id)).map((n) => n.title)).toContain('Seller Responded')
    expect(await open(id)).toMatchObject({ ok: false, reason: 'closed' })
  })

  it('a reply sent from the seller’s own session (the real chat path) closes the report too', async () => {
    const id = await paidOrder()
    await open(id)
    const cv = await say(id, fx!.admin.id)
    const { error } = await (fx!.seller.client.from('messages').insert as any)({ conversation_id: cv, sender_id: fx!.seller.id, content: 'delivering now' })
    expect(error).toBeNull()
    expect((await claim(id)).status).toBe('seller_responded')
  })

  it('buyer messages and system notices do not count as a seller response', async () => {
    const id = await paidOrder()
    await open(id)
    await say(id, fx!.admin.id)
    await say(id, null)
    expect((await claim(id)).status).toBe('open')
  })

  it('a seller reply AFTER the window is too late: the report still expires', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    await say(id, fx!.seller.id)
    expect((await claim(id)).status).toBe('open')
    expect(await sync(id)).toMatchObject({ synced: true, outcome: 'expired' })
  })

  it('Start delivery inside the window counts as a response', async () => {
    const id = await paidOrder()
    await open(id)
    await rpc('order_mark_delivering', { p_order_id: id, p_seller_id: fx!.seller.id })
    expect(await sync(id)).toMatchObject({ synced: true, outcome: 'seller_responded' })
    expect((await claim(id)).response_kind).toBe('started_delivery')
  })

  it('request cancel: refused inside the window; after expiry it files ONE pending request and alerts the admins', async () => {
    const id = await paidOrder()
    await open(id)
    expect(await requestCancel(id)).toMatchObject({ ok: false, reason: 'not_expired' })
    await ageClaim(id)
    const r = await requestCancel(id) // expires the report on the way
    expect(r.ok).toBe(true)
    const req = await requestRow(r.request_id)
    expect(req).toMatchObject({ order_id: id, buyer_id: fx!.admin.id, status: 'pending' })
    expect(req.reason).toMatch(/Not delivered/)
    expect(req.reason).toMatch(/Seller went quiet/)
    const c = await claim(id)
    expect(c.status).toBe('cancel_requested')
    expect(c.cancellation_request_id).toBe(r.request_id)
    const { data: alerts } = await fx!.svc.from('notifications').select('user_id, link').eq('type', 'order_review').like('title', 'Cancellation Request — Not Delivered%')
    expect(((alerts ?? []) as any[]).some((a) => a.user_id === fx!.admin.id && a.link === '/admin/orders?tab=cancellations')).toBe(true)
    expect(await requestCancel(id)).toMatchObject({ ok: false, reason: 'exists' })
    expect(await requestCancel(id, fx!.seller.id)).toMatchObject({ ok: false, reason: 'not_owner' })
    expect(await orderStatus(id)).toBe('paid')
  })

  it('the seller delivers before the admin acts → the report and the pending request close', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    const r = await requestCancel(id)
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    expect(await sync(id)).toMatchObject({ synced: true, outcome: 'delivered' })
    expect((await claim(id)).status).toBe('delivered')
    const req = await requestRow(r.request_id)
    expect(req.status).toBe('closed')
    expect(req.admin_notes).toMatch(/delivered/i)
  })

  it('a withdrawn request (buyer deleted it) puts the report back to expired', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    const r = await requestCancel(id)
    await fx!.svc.from('order_cancellation_requests').delete().eq('id', r.request_id)
    expect(await sync(id)).toMatchObject({ synced: true, outcome: 'expired' })
    expect((await claim(id)).status).toBe('expired')
    expect((await requestCancel(id)).ok).toBe(true)
  })

  it('withdraw stops it; the sweep list returns only open reports past their window', async () => {
    const a = await paidOrder()
    const b = await paidOrder()
    await open(a)
    await open(b)
    expect((await rpc('order_not_delivered_withdraw', { p_order_id: a, p_buyer_id: fx!.admin.id })).ok).toBe(true)
    expect((await claim(a)).status).toBe('withdrawn')
    await ageClaim(a)
    await ageClaim(b)
    const due: string[] = (await rpc('order_not_delivered_due', { p_limit: 50 })) ?? []
    expect(due).toContain(b)
    expect(due).not.toContain(a)
    expect(await open(a)).toMatchObject({ ok: true, already: false })
  })

  it('the not-delivered functions and table are service-role only', async () => {
    for (const [fn, args] of [
      ['order_not_delivered_open', { p_order_id: made[0], p_buyer_id: fx!.buyer.id, p_due_at: past(5), p_window_minutes: 20 }],
      ['order_not_delivered_withdraw', { p_order_id: made[0], p_buyer_id: fx!.buyer.id }],
      ['order_not_delivered_sync', { p_order_id: made[0] }],
      ['order_not_delivered_request_cancel', { p_order_id: made[0], p_buyer_id: fx!.buyer.id, p_note: null }],
      ['order_not_delivered_due', { p_limit: 1 }],
      ['order_not_delivered_mark_responded', { p_order_id: made[0], p_kind: 'message', p_at: new Date().toISOString() }],
    ] as const) {
      const { error } = await (fx!.buyer.client.rpc as any)(fn, args)
      expect(error?.code, fn).toBe('42501')
    }
    const { error } = await (fx!.buyer.client.from('order_not_delivered_claims' as any).select('order_id') as any).limit(1)
    expect(error?.code).toBe('42501')
  })
})
