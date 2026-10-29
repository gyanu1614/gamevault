import { describe, it, expect } from 'vitest'

import { buildDisputeEvidence, deviceLabel, redactChatLine, type DisputeEvidenceInput } from './dispute-evidence'

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
    instantDeliveredAt: null,
    deliveryProofFiles: 2,
    accessLog: [],
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
    expect(e.uncategorized_text).toContain('[2026-10-01 10:05 UTC] Buyer: hi, my user is sam123')
    // Seller messages carry login details on account sales: times only.
    expect(e.uncategorized_text).toContain('[2026-10-01 10:19 UTC] Seller: (message sent)')
    expect(e.uncategorized_text).not.toContain('check your trades')
    expect(e.refund_policy_disclosure).toContain('https://dropmarket.gg/legal/refunds')
  })

  it('adds the purchase IP and every visit the buyer made to the delivered order', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    const e = buildDisputeEvidence(input({
      buyerConfirmedAt: null,
      completedAt: null,
      accessLog: [
        { event: 'checkout', firstSeen: '2026-10-01T09:59:00.000Z', lastSeen: '2026-10-01T09:59:00.000Z', hits: 1, ip: '203.0.113.7', userAgent: iphone },
        { event: 'view', firstSeen: '2026-10-01T10:25:00.000Z', lastSeen: '2026-10-02T08:00:00.000Z', hits: 4, ip: '203.0.113.7', userAgent: iphone },
        { event: 'view', firstSeen: '2026-10-03T12:00:00.000Z', lastSeen: '2026-10-03T12:00:00.000Z', hits: 1, ip: null, userAgent: '' },
      ],
    }))
    expect(e.customer_purchase_ip).toBe('203.0.113.7')
    const log = e.access_activity_log.split('\n')
    expect(log).toContain('2026-10-01 09:59 UTC — Payment made from IP 203.0.113.7 (Safari on iPhone)')
    expect(log).toContain('2026-10-01 10:25 UTC to 2026-10-02 08:00 UTC — Buyer opened the delivered order 4 times from IP 203.0.113.7, the same IP as the payment (Safari on iPhone)')
    expect(log).toContain('2026-10-03 12:00 UTC — Buyer opened the delivered order once (Unknown device)')
    expect(e.uncategorized_text).toContain('After delivery the buyer opened the order page 5 times, first on 2026-10-01 10:25 UTC, including from the IP address they paid from.')
  })

  it('names the device from a user agent', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe('Chrome on Windows')
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge on Windows')
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome on Android')
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox on Mac')
    expect(deviceLabel('')).toBe('Unknown device')
  })

  it('leaves out what the order does not have', () => {
    const e = buildDisputeEvidence(input({
      buyer: { email: null, name: null }, sellerMarkedDeliveredAt: null, deliveredAt: null,
      buyerConfirmedAt: null, completedAt: null, deliveryProofFiles: 0, messages: [],
    }))
    expect(e).not.toHaveProperty('customer_email_address')
    expect(e).not.toHaveProperty('service_date')
    expect(e).not.toHaveProperty('customer_purchase_ip')
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

describe('redactChatLine', () => {
  it('drops login details and masks emails and long numbers', () => {
    expect(redactChatLine('email: me@x.com pass: hunter2')).toBe('(account details, not included)')
    expect(redactChatLine('Password - abc123')).toBe('(account details, not included)')
    expect(redactChatLine('write me at me@x.com or +44 7700 900123')).toBe('write me at [email] or [number]')
    expect(redactChatLine('my password is hunter2')).toBe('(account details, not included)')
    expect(redactChatLine('pw hunter2 ok?')).toBe('(account details, not included)')
    expect(redactChatLine('code: 123456')).toBe('(account details, not included)')
    expect(redactChatLine('got it,\n thanks!')).toBe('got it, thanks!')
    expect(redactChatLine('my user is sam123, thanks for the code tip')).toBe('my user is sam123, thanks for the code tip')
  })
})
