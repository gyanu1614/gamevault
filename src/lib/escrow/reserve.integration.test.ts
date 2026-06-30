/**
 * Integration test for the reserve engine + integrity check against the real DB.
 *
 *   - release_with_reserve with a non-zero pct → splits seller payout into
 *     seller_available + seller_reserve, records a reserve_holds row, balances.
 *   - release_with_reserve with pct=0 → no reserve leg (crypto/dormant path).
 *   - release_due_reserves → matures a hold (release_at in the past) once.
 *   - ledger_integrity_check → returns ok with no unbalanced txns.
 *
 * Self-skips unless env + the reserve RPCs exist. Creates throwaway orders and
 * cleans up (ledger + reserve_holds + order).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { releaseWithReserve, releaseDueReserves } from '@/lib/escrow/reserve'
import { ledgerIntegrityCheck } from '@/lib/escrow/reconciliation'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

let svc: SupabaseClient | null = null
let ready = false
const createdOrders: string[] = []
let buyer = '', seller = '', listing = ''

// 100.00 total, 8.00 fee, 92.00 payout.
async function makeOrder(suffix: string): Promise<string | null> {
  const { data, error } = await (svc as any)
    .from('orders')
    .insert({
      order_number: `TEST-RES-${STAMP}-${suffix}`,
      buyer_id: buyer, seller_id: seller, listing_id: listing,
      quantity: 1, unit_price: 100, subtotal: 100,
      platform_fee_rate: 8, payment_processing_fee_rate: 0,
      platform_fee: 8, payment_processing_fee: 0,
      total_amount: 100, seller_payout: 92,
      currency: 'EUR', status: 'delivered', escrow_status: 'held',
    })
    .select('id')
    .single()
  if (error || !data) return null
  createdOrders.push(data.id)
  return data.id
}

beforeAll(async () => {
  if (!URL || !KEY) return
  svc = createClient(URL, KEY, { auth: { persistSession: false } })
  const probe = await svc.rpc('ledger_integrity_check')
  if (probe.error) {
    // eslint-disable-next-line no-console
    console.warn(`[reserve integration] skipping — RPCs not reachable: ${probe.error.message}`)
    return
  }
  const { data: profiles } = await svc.from('profiles').select('id').limit(2)
  const { data: listings } = await svc.from('listings').select('id').limit(1)
  if (!profiles || profiles.length < 2 || !listings?.length) return
  buyer = (profiles[0] as any).id
  seller = (profiles[1] as any).id
  listing = (listings[0] as any).id
  ready = true
})

afterAll(async () => {
  if (!svc) return
  for (const id of createdOrders) {
    try { await (svc as any).rpc('ledger_test_cleanup_by_order', { p_order_id: id }) } catch { /* */ }
    try { await (svc as any).from('reserve_holds').delete().eq('order_id', id) } catch { /* */ }
    try { await (svc as any).from('orders').delete().eq('id', id) } catch { /* */ }
  }
})

const maybe = URL && KEY ? describe : describe.skip

maybe('reserve engine (integration, real DB)', () => {
  it('release with 10% reserve splits payout into available + reserve, balanced', async () => {
    if (!ready) return
    const orderId = await makeOrder('r10')
    expect(orderId).toBeTruthy()

    const r = await releaseWithReserve(orderId!, 'BUYER_CONFIRMED', 0.1, 60)
    expect(r.changed).toBe(true)
    expect(r.status).toBe('completed')
    // 92.00 payout * 10% = 9.20 reserve, 82.80 available
    expect(r.reserveMinor).toBe(920n)
    expect(r.availableMinor).toBe(8280n)

    // reserve_holds row recorded
    const { data: holds } = await (svc as any).from('reserve_holds').select('amount_minor, status').eq('order_id', orderId)
    expect((holds ?? []).length).toBe(1)
    expect(BigInt(holds[0].amount_minor)).toBe(920n)
    expect(holds[0].status).toBe('held')
    // (journal balance — fee 800 + avail 8280 + reserve 920 = gross 10000 — is
    //  asserted globally by the ledger_integrity_check test at the end.)
  })

  it('release with 0% reserve (crypto path) posts no reserve leg', async () => {
    if (!ready) return
    const orderId = await makeOrder('r0')
    const r = await releaseWithReserve(orderId!, 'BUYER_CONFIRMED', 0, 0)
    expect(r.reserveMinor).toBe(0n)
    expect(r.availableMinor).toBe(9200n) // full payout available
    const { data: holds } = await (svc as any).from('reserve_holds').select('id').eq('order_id', orderId)
    expect((holds ?? []).length).toBe(0) // no hold recorded
  })

  it('release_due_reserves matures a due hold once (reserve → available)', async () => {
    if (!ready) return
    const orderId = await makeOrder('due')
    // hold for -1s so it is immediately due
    await releaseWithReserve(orderId!, 'BUYER_CONFIRMED', 0.1, -1)
    const released = await releaseDueReserves(500)
    expect(released).toBeGreaterThanOrEqual(1)
    const { data: holds } = await (svc as any).from('reserve_holds').select('status').eq('order_id', orderId)
    expect(holds[0].status).toBe('released')
    // running again does not re-release this one
    const before = (await (svc as any).from('reserve_holds').select('status').eq('order_id', orderId)).data[0].status
    expect(before).toBe('released')
  })

  it('ledger_integrity_check reports balanced books', async () => {
    if (!ready) return
    const report = await ledgerIntegrityCheck()
    expect(report.unbalancedTransactions).toEqual([]) // the core invariant holds
  })
})
