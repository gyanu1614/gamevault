/**
 * /fees "Withdrawals" quotes payout fees and minimums live from the same
 * read /sell/fees uses (getPublicWithdrawalTerms). The PSP site review
 * (2026-10-23) found /fees saying a $100 Payoneer minimum while /sell/fees
 * said $50: the legal text was typed in and the table had changed.
 */
import { describe, it, expect } from 'vitest'

import type { PublicWithdrawalTerms } from './public-rates'
import { withdrawalTermsBlocks } from './withdrawal-legal'

const terms = (over: Partial<PublicWithdrawalTerms> = {}): PublicWithdrawalTerms => ({
  methods: [
    { name: 'usdt_trc20', displayName: 'USDT (TRC20)', type: 'crypto', feePct: 3, feeFixed: 5, feeMin: 0, minWithdrawal: 50, maxWithdrawal: null },
    { name: 'payoneer', displayName: 'Payoneer', type: 'fiat', feePct: 3, feeFixed: 0, feeMin: 5, minWithdrawal: 50, maxWithdrawal: null },
  ],
  completionHoldHours: 24,
  disputeWindowDays: 7,
  minAccountAgeDays: 30,
  payoutFreezeHours: 24,
  windows: [],
  generatedAt: '2026-10-23T00:00:00.000Z',
  ...over,
})

describe('withdrawalTermsBlocks', () => {
  it('a table row per payout method with its fee and minimum', () => {
    const [table] = withdrawalTermsBlocks(terms())
    expect(table).toEqual({
      t: 'table',
      head: ['Payout method', 'Fee', 'Minimum withdrawal'],
      rows: [
        ['USDT (TRC20)', '3% + $5', '$50'],
        ['Payoneer', '3%, at least $5', '$50'],
      ],
    })
  })

  it('timing rules come from the same settings row', () => {
    const [, list] = withdrawalTermsBlocks(terms())
    const text = JSON.stringify(list)
    expect(text).toContain('24 hours after the Buyer confirms receipt')
    expect(text).toContain('withdrawals open 30 days after')
    expect(text).toContain('pauses withdrawals for 1 day')
    expect(JSON.stringify(withdrawalTermsBlocks(terms({ payoutFreezeHours: 48 }))[1])).toContain('pauses withdrawals for 2 days')
    expect(JSON.stringify(withdrawalTermsBlocks(terms({ payoutFreezeHours: 12 }))[1])).toContain('pauses withdrawals for 12 hours')
  })

  it('no active payout method still says so', () => {
    const [table] = withdrawalTermsBlocks(terms({ methods: [] }))
    expect(table).toEqual({ t: 'table', head: ['Payout method', 'Fee', 'Minimum withdrawal'], rows: [['No payout methods are currently enabled.', '', '']] })
  })
})
