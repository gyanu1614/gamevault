/**
 * orders: the session roles keep only what they use (20260928150059_orders_session_privileges.sql).
 *
 * Before: anon + authenticated held table-level INSERT, DELETE, TRUNCATE,
 * TRIGGER and REFERENCES on orders (the Supabase default grant), and the RLS
 * policy "Admins can delete orders" let any admin SESSION hard-delete an
 * order through PostgREST — no audit row, no money seam. INSERT only held
 * because no INSERT policy exists; TRUNCATE ignores RLS entirely.
 * seller_dashboard_stats (a read-only dashboard view, but auto-updatable)
 * carried INSERT / UPDATE / DELETE for authenticated: a second write path
 * into profiles next to the table's own.
 *
 * Inventory (2026-09-28): no client in src/ inserts or deletes orders; the
 * only SQL that does is order_create_pending (SECURITY DEFINER,
 * service_role-only). FK cascades run as the table owner. The app only ever
 * SELECTs seller_dashboard_stats.
 *
 * INSERT / DELETE / view writes are probed through PostgREST as real
 * buyer / seller / admin sessions and the bare anon key; TRUNCATE / TRIGGER /
 * REFERENCES cannot be issued through PostgREST, so they are read from the
 * catalog (local stack, psql). UPDATE on orders is 20260928142017 (PR #108).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Actor, type Fixture } from './throwaway'
import { targetIsLocal, testDbUrl } from './fixture-namespace'

let fx: Fixture | null = null
const anonActor = (): Actor => ({ id: 'anon', client: createClient(URL!, ANON!, { auth: { persistSession: false } }) })
const actors = () => ({ buyer: fx!.buyer, seller: fx!.seller, admin: fx!.admin, anon: anonActor() })

/** A privilege refusal — not RLS ("violates row-level security") and not a guard trigger. */
function isPrivilegeRefusal(error: { code?: string; message: string } | null, relation: string): boolean {
  return error?.code === '42501' && new RegExp(`permission denied for (table|view) ${relation}`).test(error.message)
}

function orderRowFor(buyerId: string) {
  return {
    buyer_id: buyerId, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
    status: 'paid', escrow_status: 'held',
  }
}

async function orderIdsOf(buyerId: string): Promise<string[]> {
  const { data, error } = await fx!.svc.from('orders').select('id').eq('buyer_id', buyerId).order('id')
  if (error) throw new Error(`orderIdsOf: ${error.message}`)
  return ((data ?? []) as { id: string }[]).map((r) => r.id)
}

/** `role.privilege` pairs the catalog still grants on `relation` (local stack only). */
function grantedPrivileges(relation: string, privileges: string[]): string[] {
  const sql = `SELECT r || '.' || p FROM unnest(ARRAY['anon','authenticated']) r, unnest(ARRAY['${privileges.join("','")}']) p ` +
    `WHERE has_table_privilege(r, '${relation}', p) ` +
    `OR (p IN ('INSERT','UPDATE','REFERENCES') AND has_any_column_privilege(r, '${relation}', p)) ORDER BY 1`
  const out = execFileSync('psql', [testDbUrl(), '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' })
  return out.split('\n').map((l) => l.trim()).filter(Boolean)
}

describe.skipIf(!hasEnv)('orders — session roles hold no INSERT / DELETE / TRUNCATE / TRIGGER / REFERENCES (integration)', () => {
  beforeAll(async () => { fx = await makeFixture() }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('no session role can INSERT an order through PostgREST (privilege, not just the missing RLS policy)', async () => {
    const before = await orderIdsOf(fx!.buyer.id)
    const refused: string[] = []
    for (const [who, actor] of Object.entries(actors())) {
      const { error } = await actor.client.from('orders').insert(orderRowFor(fx!.buyer.id) as any)
      if (!isPrivilegeRefusal(error, 'orders')) refused.push(`${who} → ${error ? `${error.code}: ${error.message}` : 'inserted'}`)
    }
    expect(refused, `INSERT not refused by privilege:\n  ${refused.join('\n  ')}`).toEqual([])
    expect(await orderIdsOf(fx!.buyer.id)).toEqual(before)
  })

  it('no session role — admin included — can DELETE an order through PostgREST', async () => {
    const refused: string[] = []
    for (const [who, actor] of Object.entries(actors())) {
      const { error } = await actor.client.from('orders').delete().eq('id', fx!.completedOrderId)
      if (!isPrivilegeRefusal(error, 'orders')) refused.push(`${who} → ${error ? `${error.code}: ${error.message}` : 'accepted'}`)
    }
    expect(refused, `DELETE not refused by privilege:\n  ${refused.join('\n  ')}`).toEqual([])
    const { data } = await fx!.svc.from('orders').select('id').eq('id', fx!.completedOrderId).maybeSingle()
    expect(data, 'the completed order must survive').not.toBeNull()
  })

  it.skipIf(!targetIsLocal())('catalog: anon / authenticated hold no INSERT, DELETE, TRUNCATE, TRIGGER or REFERENCES on orders (table or column)', () => {
    expect(grantedPrivileges('public.orders', ['INSERT', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES'])).toEqual([])
  })

  it('seller_dashboard_stats refuses writes through the view (INSERT / UPDATE / DELETE)', async () => {
    const { data: before } = await fx!.svc.from('profiles').select('username, seller_tier').eq('id', fx!.seller.id).single()
    const v = () => fx!.seller.client.from('seller_dashboard_stats')
    const attempts = {
      update: await v().update({ username: 'gt_view_rename' } as any).eq('seller_id', fx!.seller.id),
      insert: await v().insert({ seller_id: fx!.seller.id, username: 'gt_view_insert' } as any),
      delete: await v().delete().eq('seller_id', fx!.seller.id),
    }
    const refused = Object.entries(attempts)
      .filter(([, r]) => !isPrivilegeRefusal(r.error, 'seller_dashboard_stats'))
      .map(([op, r]) => `${op} → ${r.error ? `${r.error.code}: ${r.error.message}` : 'accepted'}`)
    expect(refused, `view writes not refused by privilege:\n  ${refused.join('\n  ')}`).toEqual([])
    const { data: after } = await fx!.svc.from('profiles').select('username, seller_tier').eq('id', fx!.seller.id).single()
    expect(after).toEqual(before)
  })

  it.skipIf(!targetIsLocal())('catalog: anon / authenticated hold only SELECT on seller_dashboard_stats', () => {
    expect(grantedPrivileges('public.seller_dashboard_stats', ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES'])).toEqual([])
  })

  // ── what the app does still works ─────────────────────────────────────────
  it('both parties still read their own order, and the seller still reads their dashboard stats', async () => {
    for (const actor of [fx!.buyer, fx!.seller]) {
      const { data, error } = await actor.client.from('orders').select('id, status').eq('id', fx!.pendingOrderId).maybeSingle()
      expect(error).toBeNull()
      expect(data).toMatchObject({ id: fx!.pendingOrderId, status: 'pending' })
    }
    const { data, error } = await fx!.seller.client.from('seller_dashboard_stats').select('seller_id, pending_orders').eq('seller_id', fx!.seller.id).maybeSingle()
    expect(error).toBeNull()
    expect(data).toMatchObject({ seller_id: fx!.seller.id })
    expect(Number((data as any).pending_orders)).toBe(1)
  })

  it('the service role still inserts and deletes orders (checkout RPC, cleanup, admin actions)', async () => {
    const { data, error } = await fx!.svc.from('orders').insert(orderRowFor(fx!.buyer.id)).select('id').single()
    expect(error).toBeNull()
    const id = (data as { id: string }).id
    const del = await fx!.svc.from('orders').delete().eq('id', id)
    expect(del.error).toBeNull()
    const { data: gone } = await fx!.svc.from('orders').select('id').eq('id', id).maybeSingle()
    expect(gone).toBeNull()
  })
})
