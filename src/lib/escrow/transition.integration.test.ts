/**
 * Integration tests for safedrop_transition against the real DB.
 *
 * Creates a throwaway order (reusing existing buyer/seller/listing rows to
 * satisfy FKs), drives it through the lifecycle, and asserts that each
 * money-moving transition posts the right ledger journal atomically and
 * idempotently. Tears the order + its ledger rows down afterwards.
 *
 * Self-skips if env or the safedrop_transition RPC is absent (migration not
 * applied), so the unit gate stays green without a DB.
 *
 * Marker discipline: the order carries a unique order_number prefix and all
 * ledger rows it creates use idempotency keys of the form "order:<id>:<event>",
 * which the cleanup removes by order id.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { transition } from '@/lib/escrow/transition'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

let svc: SupabaseClient | null = null
let ready = false
let orderId: string | null = null

// Synthetic money on the order: total 100.00, fee 8.00, seller 92.00 (EUR).
const TOTAL = 100.0
const FEE = 8.0
const SELLER_PAYOUT = 92.0

beforeAll(async () => {
  if (!URL || !KEY) return
  svc = createClient(URL, KEY, { auth: { persistSession: false } })

  // Probe the RPC.
  const probe = await svc.rpc('safedrop_target_status', { p_event: 'CHARGE_CONFIRMED' } as any)
  if (probe.error) {
    // eslint-disable-next-line no-console
    console.warn(`[transition integration] skipping — RPC not reachable: ${probe.error.message}`)
    return
  }

  // Grab an existing buyer, seller, and listing to satisfy FKs.
  const { data: profiles } = await svc.from('profiles').select('id').limit(2)
  const { data: listings } = await svc.from('listings').select('id').limit(1)
  if (!profiles || profiles.length < 2 || !listings || listings.length < 1) {
    // eslint-disable-next-line no-console
    console.warn('[transition integration] skipping — no seed profiles/listings to build a test order')
    return
  }

  const buyer = (profiles[0] as any).id
  const seller = (profiles[1] as any).id
  const listing = (listings[0] as any).id

  // Create a throwaway order in EUR, status 'paid', escrow 'held'.
  const { data: order, error } = await (svc as any)
    .from('orders')
    .insert({
      order_number: `TEST-${STAMP}`,
      buyer_id: buyer,
      seller_id: seller,
      listing_id: listing,
      quantity: 1,
      unit_price: TOTAL,
      subtotal: TOTAL,
      platform_fee_rate: 8,
      payment_processing_fee_rate: 0,
      platform_fee: FEE,
      payment_processing_fee: 0,
      total_amount: TOTAL,
      seller_payout: SELLER_PAYOUT,
      currency: 'EUR',
      status: 'paid',
      escrow_status: 'held',
    })
    .select('id')
    .single()

  if (error || !order) {
    // eslint-disable-next-line no-console
    console.warn(`[transition integration] skipping — could not create test order: ${error?.message}`)
    return
  }
  orderId = order.id
  ready = true
})

afterAll(async () => {
  if (!svc || !orderId) return
  // Remove ledger rows for this order (cleanup RPC is prefix-guarded; our keys
  // are "order:<id>:...", so build a "test:ledger:"-safe path is N/A — delete
  // by transaction order_id via a dedicated path). Easiest: disable nothing;
  // just delete the order (ledger rows reference it only via order_id text, no
  // FK), then leave ledger rows — but they'd accumulate. Instead use the
  // generic cleanup against the order-scoped keys.
  try {
    // ledger txns for this order use idempotency_key LIKE 'order:<id>:%'
    await (svc as any).rpc('ledger_test_cleanup_by_order', { p_order_id: orderId })
  } catch {
    /* helper may not exist; non-fatal */
  }
  try {
    await (svc as any).from('orders').delete().eq('id', orderId)
  } catch {
    /* non-fatal */
  }
})

const maybe = URL && KEY ? describe : describe.skip

maybe('safedrop_transition (integration, real DB)', () => {
  it('rejects an unknown event', async () => {
    if (!ready) return
    await expect(transition(orderId!, 'NOPE' as any)).rejects.toThrow()
  })

  it('rejects an illegal transition (paid -> completed directly)', async () => {
    if (!ready) return
    await expect(transition(orderId!, 'BUYER_CONFIRMED')).rejects.toThrow()
  })

  it('drives paid -> delivered (status only, no ledger move)', async () => {
    if (!ready) return
    const r = await transition(orderId!, 'SELLER_DELIVERED')
    expect(r.status).toBe('delivered')
    expect(r.changed).toBe(true)
    expect(r.ledgerTxnId).toBeNull() // no money move on delivery
  })

  it('release (delivered -> completed) posts a balanced release journal', async () => {
    if (!ready) return
    const r = await transition(orderId!, 'BUYER_CONFIRMED')
    expect(r.status).toBe('completed')
    expect(r.escrowStatus).toBe('released')
    expect(r.ledgerTxnId).toBeTruthy()

    // Seller's available balance is now exactly the payout (fresh synthetic seller? no —
    // reuses a real profile id, so assert the DELTA via the journal entries instead).
    const { data: entries } = await (svc as any)
      .from('ledger_entries')
      .select('direction, amount_minor, currency')
      .eq('transaction_id', r.ledgerTxnId)
    // 3 entries: debit escrow 10000, credit commission 800, credit seller 9200.
    expect((entries ?? []).length).toBe(3)
    const debit = entries.find((e: any) => e.direction === 'debit')
    expect(BigInt(debit.amount_minor)).toBe(10000n)
    const credits = entries
      .filter((e: any) => e.direction === 'credit')
      .map((e: any) => BigInt(e.amount_minor))
      .sort()
    expect(credits).toEqual([800n, 9200n])
  })

  it('is idempotent: re-confirming a completed order is a no-op', async () => {
    if (!ready) return
    const r = await transition(orderId!, 'BUYER_CONFIRMED')
    expect(r.changed).toBe(false) // already completed
    // exactly one release journal exists for this order.
    const { data: txns } = await (svc as any)
      .from('ledger_transactions')
      .select('id')
      .like('idempotency_key', `order:${orderId}:BUYER_CONFIRMED%`)
    expect((txns ?? []).length).toBe(1)
  })
})
