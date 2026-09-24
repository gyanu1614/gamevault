import { describe, it, expect } from 'vitest'
import { formatScheduleDateUtc } from './public-rates'
import { buildFeeNoticeEmail } from '@/lib/email/fee-notice'

// fee_rules.starts_at values are midnight UTC. A local-timezone render west of
// Greenwich shows the PREVIOUS day (2026-10-08T00:00Z → "7 October" in PDT).
// /sell/fees and the fee notice email share ONE formatter, pinned here.
describe('schedule dates render in UTC on every seller surface', () => {
  const start = '2026-10-08T00:00:00.000Z'
  it('formatScheduleDateUtc is UTC and long-form', () => {
    expect(formatScheduleDateUtc(start)).toBe('8 October 2026')
    expect(formatScheduleDateUtc('2026-10-07T23:59:59.000Z')).toBe('7 October 2026')
  })
  it('the fee notice uses the same string /sell/fees renders', () => {
    const { subject, html } = buildFeeNoticeEmail('Seller', {
      ratesStartAt: start, foundingPeriodText: 'first year', foundingDiscountPct: 50, methods: [],
      minAccountAgeDays: 30, completionHoldHours: 24, disputeWindowDays: 7, payoutFreezeHours: 48,
      sellFeesUrl: 'https://dropmarket.gg/sell/fees', settingsUrl: 'https://dropmarket.gg/account/settings?tab=payouts',
    })
    expect(subject).toContain(formatScheduleDateUtc(start))
    expect(html).toContain(`New commission schedule from ${formatScheduleDateUtc(start)}`)
    expect(html).not.toContain('7 October 2026')
  })
})
