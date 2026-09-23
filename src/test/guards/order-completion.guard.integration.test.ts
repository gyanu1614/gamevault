/**
 * Fee engine PR 7, Part 1 — completion and release rules (integration).
 *
 * Proves, against the real RPCs on the local stack:
 *   · orders.status / delivered_at / auto_release_at are RPC-only (a session
 *     UPDATE is refused with 42501);
 *   · order_mark_delivered stamps delivered_at + auto_release_at from the
 *     per-category window table, once, for the owning seller only;
 *   · order_confirm_receipt completes and credits the seller in ONE RPC with a
 *     maturity hold (matures_at = completed_at + completion_hold_hours), so the
 *     credit is "pending" (not withdrawable) until then;
 *   · a fault inside the RPC leaves no partial state (money_fault_hook);
 *   · auto-complete: the paginated ready-list, immediate maturity, and a
 *     disputed order never auto-completes;
 *   · the halfway reminder is claimed exactly once per order;
 *   · wallet_available_balance reports available / pending / frozen / locked
 *     and the seller-age gate;
 *   · the post-completion dispute money branch freezes and unfreezes.
 *
 * Every row is fixture-owned and removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, expectGuardRejection, type Fixture } from './throwaway'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)

let fx: Fixture | null = null
let ready = false
/** game_categories.type of the fixture listing's pair, and its seeded window. */
let pairType = 'items'
let pairHours = 72
const createdOrderIds: string[] = []

function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}

async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}
async function orderRow(id: string) {
  const { data } = await fx!.svc.from('orders').select('*').eq('id', id).single()
  return data as any
}
async function insertPaidOrder(over: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
    status: 'pending', escrow_status: 'pending', ...over,
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const id = (data as any).id as string
  createdOrderIds.push(id)
  // Pay it the way the webhook does: CHARGE_CONFIRMED posts provider_float → escrow_held.
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
  return id
}
async function balance(kind: 'seller_available' | 'seller_frozen'): Promise<number> {
  return Number(await rpc('ledger_balance', { p_owner_type: 'seller', p_owner_id: fx!.seller.id, p_kind: kind, p_currency: CUR }))
}
async function matured(): Promise<number> {
  return Number(await rpc('seller_matured_balance', { p_seller_id: fx!.seller.id, p_currency: CUR }))
}
async function txnByKey(key: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id, matures_at').eq('idempotency_key', key).maybeSingle()
  return data as { id: string; matures_at: string | null } | null
}
const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000

describe.skipIf(!hasEnv)('PR 7 Part 1 — completion, hold, auto-complete, reminders (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_completion_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('listings').update({ status: 'active' }).eq('id', fx.listingId)
    // one_pending_order_per_buyer_listing: park the fixture's pending order so
    // insertPaidOrder (pending → CHARGE_CONFIRMED) can use the same pair.
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
    // The fixture reuses whatever enabled pair the game has — read its type so
    // the assertions below are about the table row, not a coincidence.
    const { data: l } = await fx.svc.from('listings').select('pair:game_categories!listings_game_category_id_fkey ( type )').eq('id', fx.listingId).single() as any
    pairType = l?.pair?.type ?? 'items'
    const { data: w } = await fx.svc.from('order_completion_windows').select('auto_complete_hours').eq('category_type', pairType).single() as any
    pairHours = Number(w?.auto_complete_hours ?? 72)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of createdOrderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', createdOrderIds)
    await fx.cleanup()
  }, 60_000)

  it('migration is applied', () => {
    expect(ready, 'apply 20260923025457_order_completion_release first').toBe(true)
  })

  it('status and the delivery timestamps are RPC-only (session UPDATE → 42501)', async () => {
    const id = await insertPaidOrder()
    expectGuardRejection(await fx!.buyer.client.from('orders').update({ status: 'completed' } as any).eq('id', id), 'orders')
    expectGuardRejection(await fx!.seller.client.from('orders').update({ status: 'delivered' } as any).eq('id', id), 'orders')
    expectGuardRejection(await fx!.seller.client.from('orders').update({ delivered_at: new Date().toISOString() } as any).eq('id', id), 'orders')
    expectGuardRejection(await fx!.seller.client.from('orders').update({ auto_release_at: new Date().toISOString() } as any).eq('id', id), 'orders')
    expect((await orderRow(id)).status).toBe('paid')
  })

  it('order_mark_delivered: owner only, window from the table, once', async () => {
    const id = await insertPaidOrder()
    const wrong = await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.buyer.id })
    expect(wrong.changed).toBe(false)
    expect(wrong.reason).toBe('not_found')

    const r = await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    expect(r.changed).toBe(true)
    expect(r.window_hours).toBe(pairHours)
    const row = await orderRow(id)
    expect(row.status).toBe('delivered')
    expect(row.escrow_status).toBe('held')
    expect(row.delivered_at).toBeTruthy()
    expect(hours(row.delivered_at, row.auto_release_at)).toBeCloseTo(pairHours, 3)

    // No money moved on delivery.
    expect(await txnByKey(`order:${id}:SELLER_DELIVERED`)).toBeNull()

    // Replay: nothing changes, the window is not restarted.
    const again = await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    expect(again.changed).toBe(false)
    expect((await orderRow(id)).auto_release_at).toBe(row.auto_release_at)
  })

  it('window is admin-editable per category type (table row drives auto_release_at)', async () => {
    await fx!.svc.from('order_completion_windows').update({ auto_complete_hours: 121 }).eq('category_type', pairType)
    try {
      const id = await insertPaidOrder()
      const r = await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
      expect(r.window_hours).toBe(121)
      const row = await orderRow(id)
      expect(hours(row.delivered_at, row.auto_release_at)).toBeCloseTo(121, 3)
    } finally {
      await fx!.svc.from('order_completion_windows').update({ auto_complete_hours: pairHours }).eq('category_type', pairType)
    }
  })

  it('order_confirm_receipt: completes + credits the seller with a maturity hold in ONE RPC', async () => {
    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    const availBefore = await balance('seller_available')
    const maturedBefore = await matured()

    const wrong = await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.seller.id })
    expect(wrong.changed).toBe(false)

    const r = await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    expect(r.changed).toBe(true)
    expect(r.status).toBe('completed')
    expect(r.escrow_status).toBe('released')
    expect(r.matures_at).toBeTruthy()

    const row = await orderRow(id)
    expect(row.status).toBe('completed')
    expect(row.release_method).toBe('buyer_confirmed')
    expect(row.buyer_confirmed_at).toBeTruthy()
    expect(hours(row.completed_at, r.matures_at)).toBeCloseTo(24, 2)

    const txn = await txnByKey(`order:${id}:BUYER_CONFIRMED`)
    expect(txn?.matures_at).toBeTruthy()
    // Credited (total balance up by $1) but NOT matured (withdrawable) yet.
    expect(await balance('seller_available')).toBe(availBefore + 100)
    expect(await matured()).toBe(maturedBefore)

    const w = await rpc('wallet_available_balance', { p_seller_id: fx!.seller.id, p_currency: CUR })
    expect(w.pending_minor).toBeGreaterThanOrEqual(100)
    expect(w.next_maturity_at).toBeTruthy()
    expect(w.completion_hold_hours).toBe(24)

    // Replay is a no-op.
    const again = await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    expect(again.changed).toBe(false)
    expect(again.reason).toBe('already_completed')
    expect(await balance('seller_available')).toBe(availBefore + 100)
  })

  it('buyer confirm on a paid (never marked delivered) order stamps delivery and completes', async () => {
    const id = await insertPaidOrder()
    const r = await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    expect(r.changed).toBe(true)
    const row = await orderRow(id)
    expect(row.status).toBe('completed')
    expect(row.delivered_at).toBeTruthy()
    expect(row.auto_release_at).toBeTruthy()
  })

  it('refuses unpaid and disputed orders with a reason (no raise, no money)', async () => {
    const { data } = await fx!.svc.from('orders').insert({
      buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
      status: 'pending', escrow_status: 'pending',
    }).select('id').single()
    const pendingId = (data as any).id as string
    createdOrderIds.push(pendingId)
    const unpaid = await rpc('order_confirm_receipt', { p_order_id: pendingId, p_buyer_id: fx!.buyer.id })
    expect(unpaid).toMatchObject({ changed: false, reason: 'not_paid' })
    await fx!.svc.from('orders').update({ status: 'cancelled' }).eq('id', pendingId) // park (one pending per buyer/listing)

    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    await rpc('safedrop_transition', { p_order_id: id, p_event: 'BUYER_DISPUTED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
    const disputed = await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    expect(disputed).toMatchObject({ changed: false, reason: 'disputed' })
    expect((await orderRow(id)).escrow_status).toBe('frozen')
    expect(await txnByKey(`order:${id}:BUYER_CONFIRMED`)).toBeNull()
    // …and a disputed order is never in the auto-complete list.
    await fx!.svc.from('orders').update({ auto_release_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id)
    const ready: any[] = await rpc('get_orders_ready_for_auto_release', { p_limit: 500 })
    expect(ready.map((o) => o.id)).not.toContain(id)
  })

  it.skipIf(!TARGET_IS_LOCAL)('a fault after the release leaves no partial state', async () => {
    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    const before = await balance('seller_available')
    const err = withFault('order_confirm_receipt:after_release',
      `SELECT public.order_confirm_receipt('${id}'::uuid, '${fx!.buyer.id}'::uuid)`)
    expect(err).toMatch(/injected fault/)
    const row = await orderRow(id)
    expect(row.status).toBe('delivered')
    expect(row.escrow_status).toBe('held')
    expect(await txnByKey(`order:${id}:BUYER_CONFIRMED`)).toBeNull()
    expect(await balance('seller_available')).toBe(before)
    // The same call succeeds afterwards (nothing half-applied blocks it).
    const r = await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    expect(r.changed).toBe(true)
  })

  it('auto-complete: paginated ready-list, credit matures immediately, idempotent', async () => {
    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    await fx!.svc.from('orders').update({ auto_release_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id)

    const page1: any[] = await rpc('get_orders_ready_for_auto_release', { p_limit: 1 })
    expect(page1.length).toBe(1)
    const all: any[] = await rpc('get_orders_ready_for_auto_release', { p_limit: 500 })
    expect(all.map((o) => o.id)).toContain(id)

    const maturedBefore = await matured()
    const { releaseDueOrder } = await import('@/lib/escrow/auto-release')
    const r = await releaseDueOrder(id)
    expect(r.success).toBe(true)
    expect(r.skipped).toBeFalsy()
    const row = await orderRow(id)
    expect(row.status).toBe('completed')
    expect(row.release_method).toBe('auto')
    const txn = await txnByKey(`order:${id}:AUTO_RELEASED`)
    expect(txn?.matures_at).toBeNull()
    expect(await matured()).toBe(maturedBefore + 100)

    const again = await releaseDueOrder(id)
    expect(again.skipped).toBe(true)
    const after: any[] = await rpc('get_orders_ready_for_auto_release', { p_limit: 500 })
    expect(after.map((o) => o.id)).not.toContain(id)
  })

  it('halfway reminder is claimed exactly once per order', async () => {
    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    // Not yet halfway: not claimed.
    const early: any[] = await rpc('order_confirm_reminders_claim', { p_limit: 500 })
    expect(early.map((o) => o.id)).not.toContain(id)

    await fx!.svc.from('orders').update({
      delivered_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      auto_release_at: new Date(Date.now() + 1 * 3_600_000).toISOString(),
    }).eq('id', id)
    const due: any[] = await rpc('order_confirm_reminders_claim', { p_limit: 500 })
    expect(due.map((o) => o.id)).toContain(id)
    expect((await orderRow(id)).confirm_reminder_sent_at).toBeTruthy()
    const twice: any[] = await rpc('order_confirm_reminders_claim', { p_limit: 500 })
    expect(twice.map((o) => o.id)).not.toContain(id)

    // The runner's comms layer: one notification (deduped), one email (mocked).
    const { sendConfirmReminders } = await import('@/lib/escrow/confirm-reminders')
    const ok = await rpc('notify_once', {
      p_user_id: fx!.buyer.id, p_type: 'order_confirm_reminder', p_title: 'Please Confirm Your Order',
      p_message: 'x', p_link: `/account/orders/${id}`, p_dedupe_key: `order:${id}:confirm_reminder`,
    })
    expect(ok).toBe(true)
    const dup = await rpc('notify_once', {
      p_user_id: fx!.buyer.id, p_type: 'order_confirm_reminder', p_title: 'Please Confirm Your Order',
      p_message: 'x', p_link: `/account/orders/${id}`, p_dedupe_key: `order:${id}:confirm_reminder`,
    })
    expect(dup).toBe(false)
    const { count } = await fx!.svc.from('notifications').select('id', { count: 'exact', head: false })
      .eq('dedupe_key', `order:${id}:confirm_reminder`)
    expect(count).toBe(1)
    const summary = await sendConfirmReminders(fx!.svc)
    expect(summary.failed).toBe(0)
  })

  it('wallet_available_balance: breakdown + seller-age gate', async () => {
    const w = await rpc('wallet_available_balance', { p_seller_id: fx!.seller.id, p_currency: CUR })
    expect(w).toMatchObject({ currency: CUR, dispute_window_days: 7 })
    for (const k of ['available_minor', 'pending_minor', 'frozen_minor', 'locked_minor', 'wallet_minor']) {
      expect(typeof w[k]).toBe('number')
    }
    expect(w.available_minor).toBe(await matured())
    expect(w.gate.eligible).toBe(false)
    expect(w.gate.reason).toBe('account_age')
    expect(w.gate.min_age_days).toBe(30)
    expect(new Date(w.gate.unlock_at).getTime() - new Date(w.gate.seller_since).getTime()).toBeCloseTo(30 * 86_400_000, -4)

    // An approval 31 days ago unlocks the gate (anchor = seller_applications.reviewed_at).
    const { data: app, error } = await fx!.svc.from('seller_applications').insert({
      user_id: fx!.seller.id, status: 'approved', reviewed_at: new Date(Date.now() - 31 * 86_400_000).toISOString(),
      is_18_or_older: true, seller_type: 'individual', display_name: 'Guard Test Seller',
    } as any).select('id').single()
    if (error) throw new Error(`seller_applications insert: ${error.message}`)
    try {
      const g = await rpc('seller_withdrawal_gate', { p_seller_id: fx!.seller.id })
      expect(g.eligible).toBe(true)
    } finally {
      await fx!.svc.from('seller_applications').delete().eq('id', (app as any).id)
    }
  })

  it('post-completion dispute freezes the seller amount; release unfreezes (money branch)', async () => {
    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
    const avail = await balance('seller_available')
    const frozen = await balance('seller_frozen')

    const d = await rpc('safedrop_transition', { p_order_id: id, p_event: 'ADMIN_DISPUTED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
    expect(d.changed).toBe(true)
    expect(d.released_before).toBe(true)
    expect((await orderRow(id))).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect(await balance('seller_available')).toBe(avail - 100)
    expect(await balance('seller_frozen')).toBe(frozen + 100)
    const w = await rpc('wallet_available_balance', { p_seller_id: fx!.seller.id, p_currency: CUR })
    expect(w.frozen_minor).toBe(frozen + 100)

    // A cancel of a released order is refused — resolve the dispute instead.
    const { error } = await (fx!.svc.rpc as any)('safedrop_transition', { p_order_id: id, p_event: 'CANCELLED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
    expect(error?.message).toMatch(/already released/)

    const r = await rpc('safedrop_transition', { p_order_id: id, p_event: 'DISPUTE_RESOLVED_SELLER', p_dedupe_key: 'test', p_release_method: 'dispute_resolved', p_refund_minor: null })
    expect(r.changed).toBe(true)
    expect((await orderRow(id))).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await balance('seller_available')).toBe(avail)
    expect(await balance('seller_frozen')).toBe(frozen)
  })
})
