/**
 * PAYMENT_NOTICE → one admin alert per active admin (admin_alert_once, deduped
 * in SQL), and nothing else: no order transition, no wallet or ledger write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { money } from '@/lib/money'

const rpc = vi.fn()
const from = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc, from }) }))

import { recordPaymentNotice } from './payment-notice'

const ORDER = '11111111-2222-3333-4444-555555555555'

function orderRow(row: Record<string, unknown> | null) {
  from.mockImplementation((table: string) => {
    if (table !== 'orders') throw new Error(`unexpected table ${table}`)
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) }
    return q
  })
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: 1, error: null })
  from.mockReset()
})

describe('recordPaymentNotice', () => {
  it('a refund alerts admins with the order number, amount and charge, linked to the order', async () => {
    orderRow({ order_number: 'DM-ABCD-EFGH', status: 'paid' })
    await recordPaymentNotice(
      { type: 'PAYMENT_NOTICE', kind: 'refund', orderId: ORDER, providerChargeId: 'ch_1', amount: money(500n, 'USD'), detail: null },
      'stripe'
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('admin_alert_once')
    expect(args.p_type).toBe('payment_review')
    expect(args.p_title).toBe('Card Refund Recorded · $5.00')
    expect(args.p_link).toBe(`/account/orders/${ORDER}`)
    expect(args.p_message).toContain('DM-ABCD-EFGH')
    expect(args.p_message).toContain('stripe/ch_1')
    expect(args.p_message).toContain('$5.00')
    expect(args.p_message).toMatch(/nothing moved/i)
  })

  it('a dispute alerts admins with its reason and deadline', async () => {
    orderRow({ order_number: 'DM-ABCD-EFGH', status: 'delivered' })
    await recordPaymentNotice(
      { type: 'PAYMENT_NOTICE', kind: 'dispute', orderId: ORDER, providerChargeId: 'ch_1', amount: money(1234n, 'USD'), detail: 'reason fraudulent, respond by 2027-01-15' },
      'stripe'
    )
    const args = rpc.mock.calls[0][1]
    expect(args.p_title).toBe('Card Dispute Opened · $12.34')
    expect(args.p_message).toContain('reason fraudulent, respond by 2027-01-15')
    expect(args.p_message).toContain('delivered')
  })

  it('still alerts when the order row is gone (short id instead of a number)', async () => {
    orderRow(null)
    await recordPaymentNotice(
      { type: 'PAYMENT_NOTICE', kind: 'refund', orderId: ORDER, providerChargeId: 'ch_1', amount: money(500n, 'USD'), detail: null },
      'stripe'
    )
    expect(rpc.mock.calls[0][1].p_message).toContain('11111111')
  })

  it('throws when the alert cannot be written (the router answers 500, the provider retries)', async () => {
    orderRow({ order_number: 'DM-1', status: 'paid' })
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(
      recordPaymentNotice(
        { type: 'PAYMENT_NOTICE', kind: 'refund', orderId: ORDER, providerChargeId: 'ch_1', amount: money(500n, 'USD'), detail: null },
        'stripe'
      )
    ).rejects.toThrow(/boom/)
  })
})
