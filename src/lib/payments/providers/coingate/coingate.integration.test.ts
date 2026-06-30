/**
 * LIVE CoinGate SANDBOX integration test.
 *
 * Exercises the real adapter against api-sandbox.coingate.com:
 *   - createCharge → real POST /v2/orders → returns a checkout URL + charge id
 *   - getCharge → real GET /v2/orders/{id} → authoritative status
 *
 * Self-skips unless COINGATE_API_TOKEN is set AND COINGATE_ENV=sandbox (we never
 * hit live from a test). No DB involved — this proves the network/credential
 * path only; the verification-chain logic is covered by the mocked unit tests.
 *
 * Uses a unique order_id per run so CoinGate's "order_id must be unique"
 * constraint never trips. These are throwaway sandbox invoices (no real money);
 * they expire on their own (~2h for `new`).
 */
import { describe, it, expect } from 'vitest'
import { makeCoinGateProvider } from './index'
import { money } from '@/lib/money'

const TOKEN = process.env.COINGATE_API_TOKEN
const ENV = process.env.COINGATE_ENV
// Only run against sandbox, never live, and only when a token is present.
const live = TOKEN && ENV === 'sandbox' ? describe : describe.skip

live('CoinGate adapter (LIVE sandbox)', () => {
  const provider = makeCoinGateProvider() // real fetch, real env

  it('createCharge creates a sandbox order and returns a checkout URL', async () => {
    const orderId = `it-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const res = await provider.createCharge({
      orderId,
      amount: money(4999n, 'EUR'), // 49.99 EUR
      returnUrl: 'http://localhost:3000/return',
    })
    expect(res.providerChargeId).toMatch(/^\d+$/) // CoinGate numeric id
    expect(res.checkoutUrl).toMatch(/^https?:\/\//)
    expect(res.rawStatus).toBe('new')

    // getCharge re-fetches the authoritative status for the same charge.
    const got = await provider.getCharge(res.providerChargeId)
    expect(['new', 'pending']).toContain(got.rawStatus) // unpaid invoice
  }, 20000)

  // FINDING (verified live): CoinGate does NOT enforce order_id uniqueness —
  // a repeated order_id creates a SECOND distinct invoice (both return 200).
  // So one-charge-per-order is OUR responsibility, not CoinGate's. We guarantee
  // it on our side: an order only transitions pending→paid once (idempotent
  // safedrop_transition + webhook_events dedupe), and we should not call
  // createCharge twice for the same order. This test pins the real behavior so
  // a future change can't silently assume CoinGate dedupes for us.
  it('does NOT enforce order_id uniqueness — second charge gets a distinct id', async () => {
    const orderId = `it-dup-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const a = await provider.createCharge({ orderId, amount: money(100n, 'EUR'), returnUrl: 'http://localhost:3000/r' })
    const b = await provider.createCharge({ orderId, amount: money(100n, 'EUR'), returnUrl: 'http://localhost:3000/r' })
    expect(a.providerChargeId).not.toBe(b.providerChargeId) // two real invoices
  }, 20000)
})
