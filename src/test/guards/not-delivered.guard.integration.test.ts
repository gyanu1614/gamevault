/**
 * "Cancel – Not Delivered" (owner 2026-10-16; plan
 * docs/superpowers/plans/2026-10-16-not-delivered-cancel-and-refund-rule.md, PR 2):
 *   · once a paid order's delivery time has passed the buyer can report it;
 *     the seller is notified and has not_delivered_grace_minutes (60);
 *   · a seller chat reply or Start delivery inside the hour closes the report
 *     (the order stays open); buyer messages and system notices don't count;
 *   · no response → finalize cancels through the existing seams as a SELLER
 *     fault: the item price as store credit, the fee kept (a card refund pays
 *     it back), fault source not_delivered; replays are no-ops;
 *   · a fault inside finalize leaves no partial state.
 * Every order it creates is removed with its ledger rows in afterAll.
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
const txn = async (key: string) => (await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()).data
const faultRow = async (orderId: string) =>
  (await fx!.svc.from('order_seller_faults').select('source').eq('order_id', orderId).maybeSingle()).data as any
const claim = async (orderId: string) =>
  (await fx!.svc.from('order_not_delivered_claims' as any).select('*').eq('order_id', orderId).maybeSingle()).data as any
const past = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
/** Fast-forward a claim past its grace hour. */
const ageClaim = async (orderId: string) => {
  const { error } = await (fx!.svc.from('order_not_delivered_claims' as any).update as any)({ grace_ends_at: past(1), opened_at: past(61) }).eq('order_id', orderId)
  if (error) throw new Error(`age claim: ${error.message}`)
}
const open = (orderId: string) => rpc('order_not_delivered_open', { p_order_id: orderId, p_buyer_id: fx!.admin.id, p_due_at: past(5) })

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
  const { error } = await (fx!.svc.from('messages').insert as any)({ conversation_id: cv.id, sender_id: senderId, content: 'on it' })
  if (error) throw new Error(`message: ${error.message}`)
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

describe.skipIf(!hasEnv)('Cancel – Not Delivered — report, 1-hour grace, auto-cancel (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of made) {
      const { data: cvs } = (await fx.svc.from('conversations').select('id').eq('order_id', id)) as any
      for (const cv of cvs ?? []) await fx.svc.from('messages').delete().eq('conversation_id', cv.id)
      await fx.svc.from('conversations').delete().eq('order_id', id)
      await fx.svc.from('order_not_delivered_claims' as any).delete().eq('order_id', id)
      await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
      await fx.svc.from('order_seller_faults').delete().eq('order_id', id)
      await fx.svc.from('notifications').delete().like('link', `%${id}%`)
      await fx.svc.from('payment_attempts').delete().eq('order_id', id)
      await fx.svc.from('orders').delete().eq('id', id)
    }
    await fx.cleanup()
  }, 120_000)

  it('the grace setting defaults to 60 minutes', async () => {
    const { data } = await fx!.svc.from('platform_fee_settings').select('not_delivered_grace_minutes' as any).single()
    expect(Number((data as any).not_delivered_grace_minutes)).toBe(60)
  })

  it('open is refused before the delivery time passes and for someone else’s order', async () => {
    const id = await paidOrder()
    const early = await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.admin.id, p_due_at: new Date(Date.now() + 60_000).toISOString() })
    expect(early).toMatchObject({ ok: false, reason: 'not_overdue' })
    const stranger = await rpc('order_not_delivered_open', { p_order_id: id, p_buyer_id: fx!.seller.id, p_due_at: past(5) })
    expect(stranger).toMatchObject({ ok: false, reason: 'not_owner' })
    expect(await claim(id)).toBeNull()
  })

  it('open starts a 60-minute grace, notifies the seller once, and a second open is a no-op', async () => {
    const id = await paidOrder()
    const r = await open(id)
    expect(r.ok).toBe(true)
    expect(r.already).toBe(false)
    const mins = (Date.parse(r.grace_ends_at) - Date.now()) / 60_000
    expect(mins).toBeGreaterThan(58)
    expect(mins).toBeLessThanOrEqual(60)
    const again = await open(id)
    expect(again).toMatchObject({ ok: true, already: true })
    const { data: n } = await fx!.svc.from('notifications').select('id').eq('user_id', fx!.seller.id).eq('type', 'order_not_delivered').like('link', `%${id}%`)
    expect((n ?? []).length).toBe(1)
  })

  it('finalize inside the grace does nothing', async () => {
    const id = await paidOrder()
    await open(id)
    expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: false, reason: 'grace' })
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
  })

  it('finalize after the grace cancels: the item price as store credit, the fee kept, a not_delivered fault', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    const before = await wallet(fx!.admin.id)
    const f = await rpc('order_not_delivered_finalize', { p_order_id: id })
    expect(f).toMatchObject({ finalized: true, outcome: 'auto_cancelled' })
    expect(Number(f.credited_minor)).toBe(2000)
    expect(Number(f.total_minor)).toBe(2142)
    expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
    expect(await txn(`fee_kept:${id}`)).not.toBeNull()
    expect((await faultRow(id))?.source).toBe('not_delivered')
    expect((await claim(id)).status).toBe('auto_cancelled')
    const { data: o } = await fx!.svc.from('orders').select('status').eq('id', id).single()
    expect((o as any).status).toBe('cancelled')
    // replay: nothing moves twice
    expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: false, reason: 'no_open_claim' })
    expect((await wallet(fx!.admin.id)) - before).toBe(2000n)
  })

  it('a delivery inside the grace closes the report with no refund', async () => {
    const id = await paidOrder()
    await open(id)
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    await ageClaim(id)
    expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: true, outcome: 'delivered' })
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
    expect((await claim(id)).status).toBe('delivered')
  })

  it('a seller chat reply inside the hour closes the report at once; nothing is refunded', async () => {
    const id = await paidOrder()
    await open(id)
    await say(id, fx!.seller.id)
    const c = await claim(id)
    expect(c.status).toBe('seller_responded')
    expect(c.response_kind).toBe('message')
    expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: false, reason: 'no_open_claim' })
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
    const { data: n } = await fx!.svc.from('notifications').select('title').eq('user_id', fx!.admin.id).eq('type', 'order_not_delivered').like('link', `%${id}%`)
    expect(((n ?? []) as any[]).map((x) => x.title)).toContain('Seller Responded')
    // the report cannot be reopened once the seller responded
    expect(await open(id)).toMatchObject({ ok: false, reason: 'closed' })
  })

  it('buyer messages and system notices do not count as a seller response', async () => {
    const id = await paidOrder()
    await open(id)
    await say(id, fx!.admin.id)
    await say(id, null)
    expect((await claim(id)).status).toBe('open')
  })

  it('a seller reply AFTER the hour is too late: the order still auto-cancels', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    await say(id, fx!.seller.id)
    expect((await claim(id)).status).toBe('open')
    expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: true, outcome: 'auto_cancelled' })
  })

  it('Start delivery inside the hour counts as a response', async () => {
    const id = await paidOrder()
    await open(id)
    await rpc('safedrop_transition', { p_order_id: id, p_event: 'SELLER_DELIVERING', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
    expect(await rpc('order_not_delivered_finalize', { p_order_id: id })).toMatchObject({ finalized: true, outcome: 'seller_responded' })
    expect((await claim(id)).response_kind).toBe('started_delivery')
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
  })

  it('withdraw stops it; the sweep list returns only open reports past their grace', async () => {
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
    // a withdrawn report can be opened again (a fresh hour)
    expect(await open(a)).toMatchObject({ ok: true, already: false })
  })

  itFault('a fault after the refund leaves the report open, the order paid and no credit', async () => {
    const id = await paidOrder()
    await open(id)
    await ageClaim(id)
    const err = withFault('order_not_delivered_finalize:after_refund', `SELECT order_not_delivered_finalize('${id}'::uuid)`)
    expect(err).toMatch(/money_fault_hook|order_not_delivered_finalize:after_refund/)
    expect(await txn(`wallet_refund:${id}`)).toBeNull()
    expect((await claim(id)).status).toBe('open')
    const { data: o } = await fx!.svc.from('orders').select('status').eq('id', id).single()
    expect((o as any).status).toBe('paid')
  })

  it('the not-delivered functions and table are service-role only', async () => {
    for (const [fn, args] of [
      ['order_not_delivered_open', { p_order_id: made[0], p_buyer_id: fx!.buyer.id, p_due_at: past(5) }],
      ['order_not_delivered_withdraw', { p_order_id: made[0], p_buyer_id: fx!.buyer.id }],
      ['order_not_delivered_finalize', { p_order_id: made[0] }],
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
