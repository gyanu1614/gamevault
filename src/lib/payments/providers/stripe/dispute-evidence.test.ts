import { describe, it, expect } from 'vitest'

import { buildDisputeEvidence, type DisputeEvidenceInput } from './dispute-evidence'

function input(over: Partial<DisputeEvidenceInput> = {}): DisputeEvidenceInput {
  return {
    orderRef: 'DM-ABCD-EFGH',
    itemTitle: 'Shadow Dragon',
    gameName: 'Adopt Me',
    amount: '$25.00',
    buyer: { email: 'buyer@example.com', name: 'Sam Buyer' },
    paidAt: '2026-10-01T10:00:00.000Z',
    sellerMarkedDeliveredAt: '2026-10-01T10:20:00.000Z',
    deliveredAt: '2026-10-01T10:20:00.000Z',
    buyerConfirmedAt: '2026-10-01T11:00:00.000Z',
    completedAt: '2026-10-01T11:00:00.000Z',
    deliveryProofFiles: 2,
    messages: [
      { at: '2026-10-01T10:05:00.000Z', from: 'Buyer', text: 'hi, my user is sam123' },
      { at: '2026-10-01T10:19:00.000Z', from: 'Seller', text: 'sent!\n\ncheck your trades' },
    ],
    policyUrl: 'https://dropmarket.gg/legal/refunds',
    ...over,
  }
}

describe('buildDisputeEvidence', () => {
  it('fills the text fields from the order record, oldest event first', () => {
    const e = buildDisputeEvidence(input())
    expect(e.product_description).toContain('Shadow Dragon (Adopt Me)')
    expect(e.customer_email_address).toBe('buyer@example.com')
    expect(e.service_date).toBe('2026-10-01')
    expect(e.access_activity_log.split('\n')).toEqual([
      '2026-10-01 10:00 UTC — Payment received',
      '2026-10-01 10:20 UTC — Seller marked the order delivered',
      '2026-10-01 10:20 UTC — Order delivered',
      '2026-10-01 11:00 UTC — Buyer confirmed they received the order',
      '2026-10-01 11:00 UTC — Order completed',
      'The seller uploaded 2 delivery proof file(s) to the order.',
    ])
    expect(e.uncategorized_text).toContain('The buyer confirmed on 2026-10-01 11:00 UTC')
    expect(e.uncategorized_text).toContain('[2026-10-01 10:19 UTC] Seller: sent! check your trades')
    expect(e.refund_policy_disclosure).toContain('https://dropmarket.gg/legal/refunds')
  })

  it('leaves out what the order does not have', () => {
    const e = buildDisputeEvidence(input({
      buyer: { email: null, name: null }, sellerMarkedDeliveredAt: null, deliveredAt: null,
      buyerConfirmedAt: null, completedAt: null, deliveryProofFiles: 0, messages: [],
    }))
    expect(e).not.toHaveProperty('customer_email_address')
    expect(e).not.toHaveProperty('service_date')
    expect(e.access_activity_log).toBe('2026-10-01 10:00 UTC — Payment received')
    expect(e.uncategorized_text).not.toContain('Order chat')
  })

  it('keeps every field inside Stripe’s limit and the chat to the latest messages', () => {
    const many = Array.from({ length: 500 }, (_, n) => ({ at: '2026-10-01T10:05:00.000Z', from: 'Buyer' as const, text: `m${n} ${'x'.repeat(2000)}` }))
    const e = buildDisputeEvidence(input({ messages: many }))
    for (const v of Object.values(e)) expect(String(v).length).toBeLessThanOrEqual(20_000)
    expect(e.uncategorized_text).toContain('most recent 60 messages')
    expect(e.uncategorized_text).not.toContain('m439 ')
  })
})
