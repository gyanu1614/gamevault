import { describe, it, expect } from 'vitest'
import { account, debit, credit, __test } from '@/lib/ledger/post-journal'
import { money } from '@/lib/money'
import { LedgerImbalanceError } from '@/lib/errors'

const { assertBalanced } = __test

const EUR = (n: bigint) => money(n, 'EUR')
const GBP = (n: bigint) => money(n, 'GBP')

const providerFloat = account('provider', null, 'provider_float')
const escrowHeld = account('platform', null, 'escrow_held')
const sellerAvail = (id: string) => account('seller', id, 'seller_available')
const platformFee = account('platform', null, 'platform_commission')

describe('ledger seam: entry builders', () => {
  it('debit/credit attach direction + account + amount', () => {
    const d = debit(providerFloat, EUR(100n))
    expect(d.direction).toBe('debit')
    expect(d.account.kind).toBe('provider_float')
    expect(d.amount.amountMinor).toBe(100n)

    const c = credit(escrowHeld, EUR(100n))
    expect(c.direction).toBe('credit')
    expect(c.account.ownerType).toBe('platform')
  })
})

describe('ledger seam: assertBalanced (the core invariant)', () => {
  it('accepts a balanced 2-entry journal (buyer pays → escrow)', () => {
    expect(() =>
      assertBalanced([debit(providerFloat, EUR(10000n)), credit(escrowHeld, EUR(10000n))])
    ).not.toThrow()
  })

  it('accepts a balanced multi-entry journal (release split: fee + seller)', () => {
    // escrow_held 100.00 → platform_commission 8.00 + seller_available 92.00
    expect(() =>
      assertBalanced([
        debit(escrowHeld, EUR(10000n)),
        credit(platformFee, EUR(800n)),
        credit(sellerAvail('s1'), EUR(9200n)),
      ])
    ).not.toThrow()
  })

  it('rejects an imbalanced journal (debits != credits)', () => {
    expect(() =>
      assertBalanced([debit(providerFloat, EUR(10000n)), credit(escrowHeld, EUR(9999n))])
    ).toThrow(LedgerImbalanceError)
  })

  it('rejects a single-entry journal', () => {
    expect(() => assertBalanced([debit(providerFloat, EUR(100n))])).toThrow(LedgerImbalanceError)
  })

  it('rejects a non-positive amount', () => {
    expect(() =>
      assertBalanced([debit(providerFloat, EUR(0n)), credit(escrowHeld, EUR(0n))])
    ).toThrow(LedgerImbalanceError)
  })

  it('balances PER currency: a journal must net to zero in each currency', () => {
    // Balanced in EUR but a stray GBP credit → reject.
    expect(() =>
      assertBalanced([
        debit(providerFloat, EUR(100n)),
        credit(escrowHeld, EUR(100n)),
        credit(platformFee, GBP(50n)),
      ])
    ).toThrow(LedgerImbalanceError)
  })

  it('allows a genuinely multi-currency balanced journal (each currency nets zero)', () => {
    expect(() =>
      assertBalanced([
        debit(providerFloat, EUR(100n)),
        credit(escrowHeld, EUR(100n)),
        debit(account('provider', null, 'provider_float'), GBP(50n)),
        credit(account('platform', null, 'escrow_held'), GBP(50n)),
      ])
    ).not.toThrow()
  })
})
