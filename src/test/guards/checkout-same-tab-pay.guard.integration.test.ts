/**
 * Same-tab Payssion pay (owner 2026-10-16) — the server side of Back.
 *
 * The buyer now leaves checkout for Payssion in the SAME tab, so Back lands
 * on checkout and Pay can be pressed again for the same listing:
 *
 *   · same pm_id again → the SAME order and the same Payssion page (no
 *     second order, no second charge);
 *   · a different Payssion pm_id → a fresh order; the old one is cancelled
 *     with its wallet hold returned — even when both totals match (PayNow and
 *     GrabPay quote the same fee; reuse used to compare the provider only);
 *   · Payssion already says the old charge is PAID (the buyer paid, then
 *     pressed Back before the webhook landed) → nothing is cancelled; the
 *     buyer is told the order is paid and sent to it.
 *
 * Every row this file causes is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

let sessionClient: SupabaseClient | null = null
let providerPaid = false
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/security/rate-limit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/security/rate-limit')>()
  return { ...real, checkRateLimit: async (name: string, id: string) => ({ limited: false, retryAfter: 60, key: `${name}:${id}` }) }
})
vi.mock('@/lib/payments/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/payments/registry')>()
  const { fakeProvider } = await import('@/lib/payments/providers/fake')
  return { ...real, getProvider: (name: string) => ({ ...fakeProvider, name }) }
})
// The provider-state probe is the seam under test; Payssion itself is not called.
vi.mock('@/lib/payments/provider-paid-probe', () => ({
  payssionPaidAtProvider: async () => providerPaid,
}))

let fx: Fixture | null = null
let listingId = ''
const tag = () => Math.random().toString(36).slice(2, 8)

async function checkout(pm: string) {
  const { createCheckout } = await import('@/lib/actions/checkout')
  return createCheckout({ listingId, quantity: 1, paymentMethodId: pm })
}
async function orderStatus(id: string) {
  const { data } = await fx!.svc.from('orders').select('status').eq('id', id).single()
  return (data as any)?.status as string
}

describe.skipIf(!hasEnv)('same-tab Payssion pay: re-checkout after Back (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    process.env.CHECKOUT_MAX_OPEN_PENDING_ORDERS = '500'
    fx = await makeFixture()
    sessionClient = fx.buyer.client
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    const { data: base } = await fx.svc.from('listings').select('game_id, game_category_id').eq('id', fx.listingId).single()
    const { data: l, error } = await fx.svc.from('listings').insert({
      seller_id: fx.seller.id, game_id: (base as any).game_id, game_category_id: (base as any).game_category_id,
      title: `GUARD-TEST-sametab-${tag()}`, description: 'same-tab pay throwaway', price: 19.99, quantity: 500, status: 'active',
    }).select('id').single()
    if (error) throw new Error(`listing insert: ${error.message}`)
    listingId = (l as any).id
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    const svc = fx.svc
    const users = [fx.buyer.id, fx.seller.id, fx.admin.id]
    const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
    const { data: orders } = await svc.from('orders').select('id, status').or(`buyer_id.in.(${users.join(',')}),seller_id.in.(${users.join(',')})`)
    for (const o of (orders ?? []) as any[]) {
      if (o.status === 'pending') await cancelOrderReturnWallet(o.id, 'test-reset').catch(() => undefined)
      await svc.rpc('ledger_test_cleanup_by_order', { p_order_id: o.id } as any)
      await svc.from('notifications').delete().like('link', `%${o.id}%`)
      await svc.from('provider_cancel_outbox').delete().eq('order_id', o.id)
      await svc.from('payment_attempts').delete().eq('order_id', o.id)
    }
    await fx.cleanup()
    if (listingId) await svc.from('listings').delete().eq('id', listingId)
  }, 120_000)

  it('the same method again reuses the same order and the same pay page', async () => {
    providerPaid = false
    const a = await checkout('paynow_sg')
    expect(a.success, a.error).toBe(true)
    const b = await checkout('paynow_sg')
    expect(b.success, b.error).toBe(true)
    expect(b.orderId).toBe(a.orderId)
    expect(b.checkoutUrl).toBe(a.checkoutUrl)
  })

  it('another Payssion method with the SAME total replaces the order (never the old method\'s page)', async () => {
    providerPaid = false
    const a = await checkout('paynow_sg')
    const b = await checkout('grabpay_sg') // same 3% fee → same total
    expect(b.success, b.error).toBe(true)
    expect(b.orderId).not.toBe(a.orderId)
    expect(await orderStatus(a.orderId!)).toBe('cancelled')
    const { data: att } = await fx!.svc.from('payment_attempts').select('pm_id').eq('order_id', b.orderId!).single()
    expect((att as any).pm_id).toBe('grabpay_sg')
  })

  it('Payssion already paid the open order: nothing is cancelled, the buyer is sent to that order', async () => {
    providerPaid = false
    const a = await checkout('fpx_my')
    expect(a.success, a.error).toBe(true)
    providerPaid = true
    const b = await checkout('touchngo_my')
    expect(b.success).toBe(false)
    expect(b.alreadyPaid).toBe(true)
    expect(b.orderId).toBe(a.orderId)
    expect(await orderStatus(a.orderId!)).toBe('pending') // the webhook confirms it, not us
    providerPaid = false
  })
})
