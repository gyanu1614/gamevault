// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PayoutDetails } from '@/lib/actions/payout-details'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'
import {
  amountRefusal,
  defaultMethodFor,
  feeTerms,
  gateMessage,
  groupMethods,
  maxWithdrawable,
  savedDestinationFor,
  shortAddress,
} from './_withdraw-model'

function method(over: Partial<WithdrawalMethod>): WithdrawalMethod {
  return {
    id: over.method_name ?? 'm',
    method_name: 'usdt_trc20',
    display_name: 'USDT (TRC-20)',
    method_type: 'crypto',
    coin: 'usdt',
    chain: 'tron',
    coming_soon: false,
    fee_percentage: 3,
    fee_fixed: 5,
    fee_min: 0,
    fee_currency: 'USD',
    min_withdrawal: 50,
    max_withdrawal: 25000,
    processing_time: '',
    icon_name: '',
    description: '',
    is_active: true,
    ...over,
  } as WithdrawalMethod
}

const TRC = method({ method_name: 'usdt_trc20', chain: 'tron' })
const ERC = method({ method_name: 'usdt_erc20', chain: 'ethereum', display_name: 'USDT (ERC-20)' })
const PAYONEER = method({ method_name: 'payoneer', display_name: 'Payoneer', method_type: 'fiat', coin: null, chain: null, min_withdrawal: 100 })
const BANK = method({ method_name: 'bank', display_name: 'Bank Transfer', method_type: 'fiat', coin: null, chain: null, coming_soon: true })

const details = (over: Partial<PayoutDetails> = {}): PayoutDetails => ({
  cryptoCoin: null,
  cryptoChain: null,
  cryptoAddress: null,
  payoneerEmail: null,
  detailsChangedAt: null,
  freezeUntil: null,
  freezeHours: 24,
  ...over,
})

const overview = (gate: Partial<WalletOverview['gate']>, negative = false) =>
  ({ negative, gate: { eligible: false, reason: null, message: null, sellerSince: null, unlockAt: null, freezeUntil: null, minAgeDays: 30, ...gate } }) as WalletOverview

const quote = (over: Partial<WithdrawalQuote>) =>
  ({ ok: false, refusal: null, message: null, amount: 0, feePct: 0, feeFixed: 0, feeMin: 0, feeAmount: 0, net: 0, minimum: null, maximum: null, available: 0, ...over }) as WithdrawalQuote

describe('groupMethods', () => {
  it('makes one row per coin, with its networks under it', () => {
    const groups = groupMethods([TRC, ERC, PAYONEER], null)
    expect(groups.map((g) => g.label)).toEqual(['USDT', 'Payoneer'])
    expect(groups[0].methods).toHaveLength(2)
  })

  it('puts the saved way of being paid first and rails not open yet last', () => {
    const groups = groupMethods([BANK, TRC, PAYONEER], details({ payoneerEmail: 'a@b.co' }))
    expect(groups.map((g) => g.key)).toEqual(['payoneer', 'usdt', 'bank'])
    expect(groups[2].comingSoon).toBe(true)
  })

  it('opens a coin on the network whose address is saved', () => {
    const saved = details({ cryptoCoin: 'usdt', cryptoChain: 'ethereum', cryptoAddress: '0xabc' })
    const [group] = groupMethods([TRC, ERC], saved)
    expect(defaultMethodFor(group).chain).toBe('ethereum')
    expect(group.readyDestination?.value).toBe('0xabc')
  })

  it('opens on the first network when nothing is saved', () => {
    const [group] = groupMethods([TRC, ERC], details())
    expect(defaultMethodFor(group).chain).toBe('tron')
    expect(group.ready).toBeNull()
  })

  it('uses the lowest minimum in the group', () => {
    const [group] = groupMethods([method({ min_withdrawal: 80 }), method({ method_name: 'b', chain: 'polygon', min_withdrawal: 50 })], null)
    expect(group.minWithdrawal).toBe(50)
  })
})

describe('savedDestinationFor', () => {
  it('does not treat an address on another network as saved', () => {
    const saved = details({ cryptoCoin: 'usdt', cryptoChain: 'tron', cryptoAddress: 'T123' })
    expect(savedDestinationFor(ERC, saved)).toBeNull()
    expect(savedDestinationFor(TRC, saved)?.value).toBe('T123')
  })

  it('reads the Payoneer email for Payoneer', () => {
    expect(savedDestinationFor(PAYONEER, details({ payoneerEmail: 'a@b.co' }))?.value).toBe('a@b.co')
    expect(savedDestinationFor(PAYONEER, details())).toBeNull()
  })
})

describe('maxWithdrawable', () => {
  it('never fills in more than the method allows', () => {
    expect(maxWithdrawable(method({ max_withdrawal: 100 }), 250)).toBe(100)
    expect(maxWithdrawable(method({ max_withdrawal: 100 }), 40)).toBe(40)
  })

  it('never goes below zero', () => {
    expect(maxWithdrawable(method({}), -5)).toBe(0)
  })
})

describe('gateMessage', () => {
  it('uses the date the gate gives for a new seller', () => {
    expect(gateMessage(overview({ reason: 'account_age', unlockAt: '2026-12-01T12:00:00Z' }))).toContain('Dec 1, 2026')
  })

  it('falls back to the database sentence for a reason it does not map', () => {
    expect(gateMessage(overview({ reason: 'kyc_required', message: 'Verify your identity.' }))).toBe('Verify your identity.')
  })

  it('explains a negative balance', () => {
    expect(gateMessage(overview({ eligible: true }, true))).toContain('below zero')
  })

  it('says nothing when the seller can withdraw', () => {
    expect(gateMessage(overview({ eligible: true }))).toBeNull()
    expect(gateMessage(null)).toBeNull()
  })
})

describe('amountRefusal', () => {
  it('shows a refusal about the amount', () => {
    expect(amountRefusal(quote({ refusal: 'below_minimum', message: 'Too low.' }), 10)).toBe('Too low.')
  })

  it('leaves refusals already shown elsewhere on the page', () => {
    expect(amountRefusal(quote({ refusal: 'kyc_required', message: 'Verify.' }), 10)).toBeNull()
    expect(amountRefusal(quote({ refusal: 'payout_details_missing', message: 'Add one.' }), 10)).toBeNull()
  })

  it('stays quiet before an amount is typed', () => {
    expect(amountRefusal(quote({ refusal: 'below_minimum', message: 'Too low.' }), 0)).toBeNull()
  })
})

describe('text helpers', () => {
  it('words the fee from the quote', () => {
    expect(feeTerms(quote({ feePct: 3, feeFixed: 5 }))).toBe('3% + $5')
    expect(feeTerms(quote({ feePct: 3, feeMin: 5 }))).toBe('3%, min $5')
  })

  it('shortens long addresses only', () => {
    expect(shortAddress('T1234567890123456789')).toBe('T12345…6789')
    expect(shortAddress('a@b.co')).toBe('a@b.co')
  })
})
