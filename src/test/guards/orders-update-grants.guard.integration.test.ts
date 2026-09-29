/**
 * orders UPDATE is not a session privilege (20260928171523_orders_update_revoke.sql).
 *
 * Before: anon + authenticated held table-level UPDATE on orders, and the RLS
 * policies "Buyers and sellers can update their orders" / "Buyers can confirm
 * their orders" / "Sellers can update their orders" let either party UPDATE
 * their own row through PostgREST. guard_orders_protected_columns refused the
 * money / identity / status columns and nothing else, so a seller could
 * rewrite the buyer's checkout_url on a pending order, and a buyer could
 * rewrite the provider / wallet mirrors (provider_charge_id,
 * wallet_amount_used), the delivery stamps, the warranty and protection
 * windows, the version counter…
 *
 * Inventory (2026-09-28): the only session-client UPDATE of orders in src/
 * was cancelOrder's best-effort cancelled_at stamp, and it was redundant —
 * validate_order_status_transition stamps cancelled_at inside the cancel
 * RPC's own transaction. Every SQL function that writes orders is SECURITY
 * DEFINER and service-role-only. So the session grant list is EMPTY: anon /
 * authenticated hold UPDATE on no orders column at all.
 *
 * Every probe runs through PostgREST as a real signed-in buyer / seller /
 * admin (the public anon key + their JWT) or the bare anon key — exactly what
 * an attacker holds — so a refusal proves the database, not app code.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Actor, type Fixture } from './throwaway'
import { purgeAuditLogsForRecords } from './fixture-namespace'

/** The session client cancelOrder gets, and every write it issues through it. */
let sessionClient: SupabaseClient | null = null
const sessionWrites: string[] = []
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

/** Records `<table>.<write>` for every insert/update/upsert/delete built on the client. */
function recordingWrites(client: SupabaseClient): SupabaseClient {
  const bind = (target: object, prop: PropertyKey) => {
    const v = Reflect.get(target, prop)
    return typeof v === 'function' ? v.bind(target) : v
  }
  return new Proxy(client, {
    get(target, prop) {
      if (prop !== 'from') return bind(target, prop)
      return (table: string) => new Proxy(target.from(table), {
        get(qb, p) {
          if (p === 'insert' || p === 'update' || p === 'upsert' || p === 'delete') sessionWrites.push(`${table}.${p}`)
          return bind(qb, p)
        },
      })
    },
  })
}

/** Generated columns refuse every UPDATE at rewrite time (428C9), before any privilege check. */
const GENERATED = new Set(['order_number_search'])

let fx: Fixture | null = null
const anonActor = (): Actor => ({ id: 'anon', client: createClient(URL!, ANON!, { auth: { persistSession: false } }) })

async function orderRow(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await fx!.svc.from('orders').select('*').eq('id', id).single()
  if (error) throw new Error(`orderRow(${id}): ${error.message}`)
  return data as Record<string, unknown>
}

/** A privilege refusal — NOT the guard trigger's 42501 ("… are protected"). */
function isPrivilegeRefusal(error: { code?: string; message: string } | null): boolean {
  return error?.code === '42501' && /permission denied for table orders/.test(error.message)
}

describe.skipIf(!hasEnv)('orders UPDATE — no session role holds it (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    // Give the pending order the buyer-side payment fields a seller would
    // want to rewrite (the backend stamps these at checkout).
    const { error } = await fx.svc.from('orders').update({
      checkout_url: 'https://pay.test/checkout/legit', payment_provider: 'fake',
      provider_charge_id: 'fake_charge_legit', wallet_amount_used: 0.5,
      payment_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    }).eq('id', fx.pendingOrderId)
    if (error) throw new Error(`fixture payment fields: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    const users = [fx.buyer.id, fx.seller.id, fx.admin.id]
    const { data: orders } = await fx.svc.from('orders').select('id').or(`buyer_id.in.(${users.join(',')}),seller_id.in.(${users.join(',')})`)
    const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id)
    for (const id of orderIds) {
      const { error } = await fx.svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any)
      if (error) failures.push(`ledger_test_cleanup_by_order(${id}): ${error.message}`)
    }
    // ORDER_STATUS_CHANGE rows from the cancel carry user_id NULL (service-role RPC).
    purgeAuditLogsForRecords(orderIds, failures)
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`orders-update-grants cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  // ── every column, every session role ──────────────────────────────────────
  // Writing each column's CURRENT value: a no-op the guard trigger lets
  // through (it compares OLD vs NEW), so only the privilege layer can refuse
  // it. The column list comes from the row itself, so a column added later is
  // covered the day it lands — and must stay ungranted unless this file says why.
  for (const who of ['buyer', 'seller', 'admin', 'anon'] as const) {
    it(`${who}: UPDATE of every orders column is refused (42501 permission denied), even a no-op`, async () => {
      const actor = who === 'anon' ? anonActor() : fx![who]
      const row = await orderRow(fx!.pendingOrderId)
      const allowed: string[] = []
      for (const [col, value] of Object.entries(row)) {
        if (GENERATED.has(col)) continue
        const { error } = await actor.client.from('orders').update({ [col]: value } as any).eq('id', fx!.pendingOrderId)
        if (!isPrivilegeRefusal(error)) allowed.push(`${col} → ${error ? `${error.code}: ${error.message}` : 'accepted'}`)
      }
      expect(allowed, `${who} could still UPDATE:\n  ${allowed.join('\n  ')}`).toEqual([])
      expect(Object.keys(row).length).toBeGreaterThan(50)
    }, 60_000)
  }

  // ── the reported exploits change nothing ──────────────────────────────────
  it('seller cannot rewrite the buyer\'s checkout_url / payment window on a pending order', async () => {
    const before = await orderRow(fx!.pendingOrderId)
    for (const patch of [
      { checkout_url: 'https://evil.test/pay' },
      { payment_expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString() },
      { payment_provider: 'evil' },
    ]) {
      const { error } = await fx!.seller.client.from('orders').update(patch as any).eq('id', fx!.pendingOrderId)
      expect(isPrivilegeRefusal(error), `${JSON.stringify(patch)}: ${error?.code} ${error?.message}`).toBe(true)
    }
    expect(await orderRow(fx!.pendingOrderId)).toEqual(before)
  })

  it('buyer cannot rewrite the provider / wallet mirrors on their own order', async () => {
    const before = await orderRow(fx!.pendingOrderId)
    for (const patch of [
      { provider_charge_id: 'forged_charge' },
      { wallet_amount_used: 0 },
      { stripe_payment_intent_id: 'pi_forged' },
      { stripe_transfer_id: 'tr_forged' },
      { paid_at: new Date().toISOString() },
    ]) {
      const { error } = await fx!.buyer.client.from('orders').update(patch as any).eq('id', fx!.pendingOrderId)
      expect(isPrivilegeRefusal(error), `${JSON.stringify(patch)}: ${error?.code} ${error?.message}`).toBe(true)
    }
    expect(await orderRow(fx!.pendingOrderId)).toEqual(before)
  })

  it('neither party can forge delivery / confirmation stamps or stretch the warranty, protection or chat windows', async () => {
    const id = fx!.completedOrderId
    const before = await orderRow(id)
    const later = new Date(Date.now() + 365 * 86_400_000).toISOString()
    const cases: Array<[Actor, Record<string, unknown>]> = [
      [fx!.seller, { seller_marked_delivered_at: new Date().toISOString() }],
      [fx!.seller, { delivering_at: new Date().toISOString() }],
      [fx!.seller, { delivery_details: { note: 'forged' } }],
      [fx!.seller, { delivery_evidence_urls: [`${id}/forged.png`] }],
      [fx!.seller, { instant_delivery_code: 'FORGED-CODE' }],
      [fx!.seller, { stock_returned_at: new Date().toISOString() }],
      [fx!.buyer, { buyer_confirmed_at: new Date().toISOString() }],
      [fx!.buyer, { warranty_expires_at: later }],
      [fx!.buyer, { protection_until: later }],
      [fx!.buyer, { chat_active_until: later }],
      [fx!.buyer, { cancelled_at: new Date().toISOString() }],
      [fx!.buyer, { version: 999 }],
    ]
    for (const [actor, patch] of cases) {
      const { error } = await actor.client.from('orders').update(patch as any).eq('id', id)
      expect(isPrivilegeRefusal(error), `${actor === fx!.buyer ? 'buyer' : 'seller'} ${JSON.stringify(patch)}: ${error?.code} ${error?.message}`).toBe(true)
    }
    expect(await orderRow(id)).toEqual(before)
  })

  // ── the legitimate paths still work ───────────────────────────────────────
  it('the service role still writes the columns the backend stamps', async () => {
    const id = fx!.completedOrderId
    const paidAt = new Date()
    const patch = {
      checkout_url: 'https://pay.test/checkout/new',
      provider_charge_id: 'fake_charge_new',
      instant_delivery_code: 'CODE-123',
      delivery_evidence_urls: [`${id}/proof.png`],
    }
    const { error } = await fx!.svc.from('orders').update({ ...patch, paid_at: paidAt.toISOString() }).eq('id', id)
    expect(error).toBeNull()
    const row = await orderRow(id)
    expect(row).toMatchObject(patch)
    expect(Date.parse(String(row.paid_at))).toBe(paidAt.getTime())
  })

  it('both parties still read their own order (SELECT is untouched)', async () => {
    for (const actor of [fx!.buyer, fx!.seller]) {
      const { data, error } = await actor.client.from('orders').select('id, status').eq('id', fx!.pendingOrderId).maybeSingle()
      expect(error).toBeNull()
      expect(data).toMatchObject({ id: fx!.pendingOrderId, status: 'pending' })
    }
  })

  // Last: it moves the fixture's pending order (one pending order per buyer +
  // listing, so the file cannot mint a second one).
  it('buyer cancels a pending order through cancelOrder with their own session; the DB stamps cancelled_at and the session never UPDATEs orders', async () => {
    const id = fx!.pendingOrderId
    sessionWrites.length = 0
    sessionClient = recordingWrites(fx!.buyer.client)
    const t0 = Date.now()
    const { cancelOrder } = await import('@/lib/actions/orders')
    const res = await cancelOrder(id)
    expect(res.success, res.error).toBe(true)
    const row = await orderRow(id)
    expect(row.status).toBe('cancelled')
    expect(row.cancelled_at, 'validate_order_status_transition stamps it in the RPC').not.toBeNull()
    const stamped = Date.parse(String(row.cancelled_at))
    expect(stamped).toBeGreaterThanOrEqual(t0 - 5_000)
    expect(stamped).toBeLessThanOrEqual(Date.now() + 5_000)
    expect(sessionWrites.filter((w) => w.startsWith('orders.'))).toEqual([])
  }, 60_000)
})
