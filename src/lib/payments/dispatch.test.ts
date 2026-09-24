import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { orderEventFor } from '@/lib/payments/dispatch'
import type { CanonicalEvent } from '@/lib/payments/types'
import { money } from '@/lib/money'

const EUR = (n: bigint) => money(n, 'EUR')

describe('dispatch: canonical event -> SafeDrop OrderEvent mapping', () => {
  it('CHARGE_CONFIRMED drives CHARGE_CONFIRMED', () => {
    expect(orderEventFor({ type: 'CHARGE_CONFIRMED', orderId: 'o1', providerChargeId: 'c1', settled: EUR(100n) }))
      .toBe('CHARGE_CONFIRMED')
  })
  it('CHARGE_FAILED cancels the order', () => {
    expect(orderEventFor({ type: 'CHARGE_FAILED', orderId: 'o1', providerChargeId: 'c1', reason: 'x' }))
      .toBe('CANCELLED')
  })
  it('REFUND_COMPLETED drives REFUNDED', () => {
    expect(orderEventFor({ type: 'REFUND_COMPLETED', orderId: 'o1', refundId: 'r1', amount: EUR(100n) }))
      .toBe('REFUNDED')
  })
  it('CHARGEBACK_OPENED drives REFUNDED (state); clawback handled separately', () => {
    expect(orderEventFor({ type: 'CHARGEBACK_OPENED', orderId: 'o1', providerChargeId: 'c1', amount: EUR(100n) }))
      .toBe('REFUNDED')
  })
  it('CHARGE_PENDING is a no-op (no order transition)', () => {
    expect(orderEventFor({ type: 'CHARGE_PENDING', orderId: 'o1', providerChargeId: 'c1' })).toBeNull()
  })
  it('payout + chargeback-resolved events do not drive order transitions', () => {
    expect(orderEventFor({ type: 'PAYOUT_COMPLETED', payoutId: 'p1', amount: EUR(100n) })).toBeNull()
    expect(orderEventFor({ type: 'PAYOUT_FAILED', payoutId: 'p1', reason: 'x' })).toBeNull()
    expect(orderEventFor({ type: 'CHARGEBACK_RESOLVED', orderId: 'o1', providerChargeId: 'c1', won: true })).toBeNull()
  })
})

// ─── Part 5 (round B): closed-order alerting lives in the DB ──────────────
describe('dispatch: no TS-side admin alerting for a payment on a closed order', () => {
  const SRC = readFileSync(join(process.cwd(), 'src/lib/payments/dispatch.ts'), 'utf8')

  it('alertAdminsPaymentForClosedOrder is gone — order_credit_late_payment credits the buyer and admin_alert_once notes it, deduped in the RPC', () => {
    expect(SRC).not.toMatch(/alertAdminsPaymentForClosedOrder/)
  })

  it('dispatch inserts no notifications itself (every admin page goes through admin_alert_once in SQL)', () => {
    expect(SRC).not.toMatch(/from\('notifications'\)/)
    expect(SRC).not.toMatch(/from\('admin_roles'\)/)
  })
})
