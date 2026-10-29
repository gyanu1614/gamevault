/**
 * Who pays a lost card chargeback (owner 2026-10-29: "if the seller
 * delivered, they shouldn't have to pay") — integration, real RPCs.
 *
 *   · a delivered order with proof — the buyer confirmed, the buyer opened the
 *     order after delivery, or the seller's delivery photo (a real file in the
 *     order's folder) — is covered by DropMarket, also when it auto-completed
 *     or was still on hold;
 *   · no delivery or no proof → the seller pays (unchanged); proof added
 *     after the chargeback opened does not count;
 *   · proof, but the buyer's own SafeDrop dispute is open → an admin decides;
 *   · once the bank returned the payment, no SafeDrop dispute or refund can
 *     pay the buyer again; a partly refunded order is only recorded;
 *   · order_access_record: buyer only, views only after delivery, deduped,
 *     capped, service role only;
 *   · a fault inside the settle rolls it all back.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import sharp from 'sharp'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture, activateFixtureListing } from './throwaway'
import { cardCaseKit, TARGET_IS_LOCAL, withFault } from './card-cases-kit'

vi.mock('server-only', () => ({}))

let fx: Fixture | null = null
let ready = false
const orders: string[] = []
const { rpc, order, cases, bal, paidOrder, delivered, completed, disputeOpen, disputeClose, safedropDisputes, cleanup } =
  cardCaseKit(() => fx!, orders)

const uploaded: string[] = []
/** The seller's delivery photo: a real file in the order's folder, then its path on the order. */
async function withPhoto(id: string) {
  const path = `${id}/1730000000000-proof.png`
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#2a6' } }).png().toBuffer()
  const { error } = await fx!.svc.storage.from('delivery-evidence').upload(path, png, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`photo upload: ${error.message}`)
  uploaded.push(path)
  await fx!.svc.from('orders').update({ delivery_evidence_urls: [path] } as any).eq('id', id)
}
const record = (id: string, userId: string, event: 'view' | 'checkout', ip = '203.0.113.7', ua = 'Mozilla/5.0 (iPhone) Safari/604.1') =>
  rpc<boolean>('order_access_record', { p_order_id: id, p_user_id: userId, p_event: event, p_ip: ip, p_user_agent: ua })
async function accessRows(id: string) {
  return ((await (fx!.svc as any).from('order_access_log').select('*').eq('order_id', id).order('first_seen_at')).data ?? []) as any[]
}

describe.skipIf(!hasEnv)('card chargebacks: delivery proof decides who pays (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await (fx.svc as any).from('order_access_log').select('id').limit(1)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (uploaded.length) await fx.svc.storage.from('delivery-evidence').remove(uploaded)
    await cleanup()
    await fx.cleanup()
  }, 60_000)

  it('migration is applied', () => {
    expect(ready, 'apply the card_case_delivery_proof migration first').toBe(true)
  })

  it('auto-completed with the seller photo, never confirmed: DropMarket pays, the seller keeps the sale', async () => {
    const id = await delivered()
    await withPhoto(id)
    await rpc('safedrop_transition', { p_order_id: id, p_event: 'AUTO_RELEASED', p_dedupe_key: null, p_release_method: 'auto', p_refund_minor: null })
    expect(await order(id)).toMatchObject({ status: 'completed', buyer_confirmed_at: null })
    const avail = await bal('seller', 'seller_available')
    const commission = await bal('platform', 'platform_commission')
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'platform' })
    expect(await order(id)).toMatchObject({ status: 'completed' })
    expect(await bal('seller', 'seller_available')).toBe(avail)
    expect(await bal('platform', 'platform_commission')).toBe(commission - 100)
  })

  it('lost while still on hold (never completed), with the seller photo: the seller is paid, DropMarket pays the card back', async () => {
    const id = await delivered()
    await withPhoto(id)
    const avail = await bal('seller', 'seller_available')
    const commission = await bal('platform', 'platform_commission')
    await disputeOpen(id)
    expect(await order(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen', completed_at: null })
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'platform' })
    expect(await order(id)).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await bal('seller', 'seller_available')).toBe(avail + 80)
    // Commission +20 from the release, -100 to pay the card back.
    expect(await bal('platform', 'platform_commission')).toBe(commission + 20 - 100)
    expect((await safedropDisputes(id)).map((d) => d.status)).toEqual(['closed'])
    expect((await cases(id))[0]).toMatchObject({ status: 'settled', bearer: 'platform' })
  })

  it('the buyer opening the order after delivery is proof on its own', async () => {
    const id = await delivered()
    expect(await record(id, fx!.buyer.id, 'view')).toBe(true)
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'platform' })
  })

  it('an instant code counts as delivered: the buyer opening it is proof', async () => {
    const id = await paidOrder()
    await fx!.svc.from('orders').update({ instant_delivery_delivered_at: new Date(Date.now() - 60_000).toISOString() } as any).eq('id', id)
    expect(await record(id, fx!.buyer.id, 'view')).toBe(true)
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'platform', proof: 'opened' })
    expect(await order(id)).toMatchObject({ status: 'completed' })
  })

  it('delivered with no photo, no confirm, no buyer view: the seller pays', async () => {
    const id = await delivered()
    // Someone other than the buyer opening the order proves nothing — and is not logged.
    expect(await record(id, fx!.seller.id, 'view')).toBe(false)
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'seller' })
    expect(await order(id)).toMatchObject({ status: 'refunded' })
  })

  it('a photo path with no file behind it is not proof', async () => {
    const id = await delivered()
    await fx!.svc.from('orders').update({ delivery_evidence_urls: [`${id}/never-uploaded.png`] } as any).eq('id', id)
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'seller' })
  })

  it('proof added after the chargeback opened does not count: the seller pays', async () => {
    const id = await paidOrder()
    await disputeOpen(id)
    // The seller delivers once the payout is on hold, adds a photo, the buyer looks.
    await rpc('order_mark_delivered_in_dispute', { p_order_id: id, p_seller_id: fx!.seller.id })
    await withPhoto(id)
    expect(await record(id, fx!.buyer.id, 'view')).toBe(true)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'seller' })
    expect(await order(id)).toMatchObject({ status: 'refunded' })
  })

  it('never delivered: a photo alone is not proof, the seller pays', async () => {
    const id = await paidOrder()
    await withPhoto(id)
    expect(await record(id, fx!.buyer.id, 'view')).toBe(false) // nothing delivered to open yet
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'seller' })
  })

  it('proof, but the buyer\'s own dispute is open: an admin decides; DropMarket Pays closes both', async () => {
    const id = await delivered()
    await withPhoto(id)
    await rpc('order_dispute_open', { p_order_id: id, p_actor_id: fx!.buyer.id, p_actor_role: 'buyer', p_reason: 'item_not_received', p_title: 'guard', p_description: 'guard buyer dispute' })
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ closed: true, settled: false, reason: 'awaiting_decision' })
    const [c] = await cases(id)
    expect(c).toMatchObject({ status: 'awaiting_decision' })
    expect(await order(id)).toMatchObject({ status: 'disputed' })
    // A replayed close changes nothing.
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: false, reason: 'awaiting_decision' })

    expect(await rpc('card_case_settle', { p_case_id: c.id, p_bearer: 'platform', p_actor_id: fx!.admin.id })).toMatchObject({ settled: true, bearer: 'platform' })
    expect(await order(id)).toMatchObject({ status: 'completed' })
    expect((await safedropDisputes(id)).map((d) => d.status)).toEqual(['closed'])
  })

  it('once the bank returned the payment, the order cannot be disputed or refunded again', async () => {
    const id = await delivered()
    await withPhoto(id)
    await disputeOpen(id)
    await disputeClose(id, 'lost') // DropMarket paid; the order is completed
    const again = await (fx!.svc.rpc as any)('order_dispute_open', { p_order_id: id, p_actor_id: fx!.buyer.id, p_actor_role: 'buyer', p_reason: 'item_not_received', p_title: 'guard', p_description: 'second claim' })
    expect(again.error?.message).toMatch(/already returned this card payment/)
    // An admin dispute (the way to a refund on a completed order) is refused too.
    const admin = await (fx!.svc.rpc as any)('safedrop_transition', { p_order_id: id, p_event: 'ADMIN_DISPUTED', p_dedupe_key: 'guard-second', p_release_method: null, p_refund_minor: null })
    expect(admin.error?.message).toMatch(/already returned this card payment/)
    expect(await order(id)).toMatchObject({ status: 'completed' })
    // A second chargeback on it is only recorded.
    expect(await rpc('card_dispute_open', { p_order_id: id, p_ref: `dp2_${id}`, p_session: `cs_${id}`, p_amount_minor: 100, p_currency: 'USD', p_reason: 'duplicate', p_due_by: null }))
      .toMatchObject({ opened: false, status: 'review' })
  })

  it('a chargeback on an order already partly refunded through a dispute is only recorded', async () => {
    const id = await delivered()
    await withPhoto(id)
    const { dispute_id } = await rpc('order_dispute_open', { p_order_id: id, p_actor_id: fx!.buyer.id, p_actor_role: 'buyer', p_reason: 'item_not_received', p_title: 'guard', p_description: 'guard partial' })
    await rpc('order_dispute_resolve', { p_dispute_id: dispute_id, p_admin_id: fx!.admin.id, p_outcome: 'refund_partial', p_refund_minor: 30, p_notes: 'guard partial' })
    expect(await disputeOpen(id)).toMatchObject({ opened: false, status: 'review' })
  })

  it('confirmed orders still go to DropMarket (unchanged)', async () => {
    const id = await completed()
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'platform' })
  })

  it('access log: views after delivery only, one row per device with a hit count, bad IPs dropped, capped per order', async () => {
    const id = await paidOrder()
    expect(await record(id, fx!.buyer.id, 'checkout')).toBe(true)
    expect(await record(id, fx!.buyer.id, 'view')).toBe(false)
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    expect(await record(id, fx!.buyer.id, 'view')).toBe(true)
    expect(await record(id, fx!.buyer.id, 'view')).toBe(true)
    expect(await record(id, fx!.buyer.id, 'view', 'not-an-ip', 'x'.repeat(900))).toBe(true)
    const rows = await accessRows(id)
    expect(rows.map((r) => [r.event, r.ip, r.hits])).toEqual([
      ['checkout', '203.0.113.7', 1],
      ['view', '203.0.113.7', 2],
      ['view', null, 1],
    ])
    expect(rows[2].user_agent).toHaveLength(300)

    for (let i = rows.length; i < 50; i++) await record(id, fx!.buyer.id, 'view', '198.51.100.1', `ua-${i}`)
    expect(await record(id, fx!.buyer.id, 'view', '198.51.100.1', 'ua-over-the-cap')).toBe(false)
    expect(await accessRows(id)).toHaveLength(50)
    // An existing device still counts its views at the cap.
    expect(await record(id, fx!.buyer.id, 'view')).toBe(true)
  })

  it('signed-in users can neither read the access log nor write to it', async () => {
    const client = fx!.buyer.client as any
    expect((await client.from('order_access_log').select('id').limit(1)).data ?? []).toEqual([])
    const r = await client.rpc('order_access_record', { p_order_id: orders[0], p_user_id: fx!.buyer.id, p_event: 'view', p_ip: null, p_user_agent: null })
    expect(r.error?.message).toMatch(/permission denied/i)
  })

  it.skipIf(!TARGET_IS_LOCAL)('a fault inside the settle rolls the whole close back', async () => {
    const id = await delivered()
    await withPhoto(id)
    await disputeOpen(id)
    const avail = await bal('seller', 'seller_available')
    const err = withFault('card_case_settle:after_journal', `SELECT public.card_dispute_close('dp_${id}', 'lost')`)
    expect(err).toMatch(/money_fault/)
    expect((await cases(id))[0]).toMatchObject({ status: 'open', closed_at: null })
    expect(await order(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect(await bal('seller', 'seller_available')).toBe(avail)
  })
})
