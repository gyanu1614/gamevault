/**
 * Integration test for the webhook spine against the real DB.
 *
 * Drives the full Phase 3 gate:
 *   - A `paid` fake-provider webhook → verified → claimed → dispatched →
 *     order PENDING_PAYMENT→PAID with the ledger journal, ONCE.
 *   - Replaying the SAME webhook → deduped (no second dispatch, no double-post).
 *   - A forged webhook (bad signature) → rejected (400) before any side effect.
 *
 * Self-skips if env or the webhook_events / safedrop RPCs are absent. Creates a
 * throwaway order (status 'paid' is the post-charge state; we drive a fresh
 * order at 'pending' to exercise CHARGE_CONFIRMED) and cleans it up.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { handleWebhook } from '@/lib/payments/webhook-router'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }

let svc: SupabaseClient | null = null
let ready = false
let orderId: string | null = null
let chargeId = ''

const TOTAL = 100.0,
  FEE = 8.0,
  SELLER_PAYOUT = 92.0

beforeAll(async () => {
  if (!URL || !KEY) return
  svc = createClient(URL, KEY, { auth: { persistSession: false } })

  // Probe webhook_events RPC.
  const probe = await svc.rpc('webhook_event_claim', {
    p_provider: 'fake',
    p_provider_event_id: `probe:${STAMP}`,
    p_payload_hash: null,
  } as any)
  if (probe.error) {
    // eslint-disable-next-line no-console
    console.warn(`[webhook integration] skipping — webhook_events not reachable: ${probe.error.message}`)
    return
  }
  // Clean the probe row (best effort).
  try {
    await (svc as any).from('webhook_events').delete().eq('provider_event_id', `probe:${STAMP}`)
  } catch {
    /* ignore */
  }

  const { data: profiles } = await svc.from('profiles').select('id').limit(2)
  const { data: listings } = await svc.from('listings').select('id').limit(1)
  if (!profiles || profiles.length < 2 || !listings?.length) return

  const { data: order, error } = await (svc as any)
    .from('orders')
    .insert({
      order_number: `TEST-WH-${STAMP}`,
      buyer_id: (profiles[0] as any).id,
      seller_id: (profiles[1] as any).id,
      listing_id: (listings[0] as any).id,
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
      status: 'pending', // start unpaid so CHARGE_CONFIRMED drives pending->paid
      escrow_status: 'held',
    })
    .select('id')
    .single()
  if (error || !order) {
    // eslint-disable-next-line no-console
    console.warn(`[webhook integration] skipping — could not create order: ${error?.message}`)
    return
  }
  orderId = order.id
  chargeId = `fake_${orderId}`
  ready = true
})

afterAll(async () => {
  if (!svc || !orderId) return
  try {
    await (svc as any).rpc('ledger_test_cleanup_by_order', { p_order_id: orderId })
  } catch {
    /* ignore */
  }
  try {
    await (svc as any).from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `${chargeId}:%`)
  } catch {
    /* ignore */
  }
  try {
    await (svc as any).from('orders').delete().eq('id', orderId)
  } catch {
    /* ignore */
  }
})

const maybe = URL && KEY ? describe : describe.skip

maybe('webhook spine (integration, real DB)', () => {
  const paidBody = () =>
    JSON.stringify({ chargeId, orderId, status: 'paid', amountMinor: '10000', currency: 'EUR' })

  it('rejects a forged webhook (bad signature) with 400, no side effect', async () => {
    if (!ready) return
    const r = await handleWebhook('fake', { 'x-fake-signature': 'WRONG' }, paidBody())
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    // order untouched
    const { data } = await (svc as any).from('orders').select('status').eq('id', orderId).single()
    expect(data.status).toBe('pending')
  })

  it('rejects an unknown provider with 404', async () => {
    if (!ready) return
    const r = await handleWebhook('nope', sig, paidBody())
    expect(r.status).toBe(404)
  })

  it('processes a paid webhook: order -> PAID + ledger journal, once', async () => {
    if (!ready) return
    const r = await handleWebhook('fake', sig, paidBody())
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.deduped).not.toBe(true)
    expect(r.processed).toBe(1)

    const { data: order } = await (svc as any).from('orders').select('status, escrow_status').eq('id', orderId).single()
    expect(order.status).toBe('paid')

    // Exactly one CHARGE_CONFIRMED ledger journal for this order.
    const { data: txns } = await (svc as any)
      .from('ledger_transactions')
      .select('id')
      .eq('order_id', orderId)
      .like('idempotency_key', '%CHARGE_CONFIRMED%')
    expect((txns ?? []).length).toBe(1)
  })

  it('replaying the same webhook is deduped — no second dispatch, no double-post', async () => {
    if (!ready) return
    const r = await handleWebhook('fake', sig, paidBody())
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.deduped).toBe(true) // caught by webhook_events unique key
    expect(r.processed).toBe(0)

    // Still exactly one journal.
    const { data: txns } = await (svc as any)
      .from('ledger_transactions')
      .select('id')
      .eq('order_id', orderId)
      .like('idempotency_key', '%CHARGE_CONFIRMED%')
    expect((txns ?? []).length).toBe(1)
  })
})
