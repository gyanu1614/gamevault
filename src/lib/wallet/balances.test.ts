import { describe, expect, it } from 'vitest'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import { balanceWarning, pendingBalance, walletBalances } from './balances'

const overview = (over: Partial<WalletOverview> = {}): WalletOverview =>
  ({ currency: 'USD', available: 0, pending: 0, nextMaturityAt: null, frozen: 0, locked: 0, wallet: 0, negative: false, completionHoldHours: 24, disputeWindowDays: 7, ...over }) as WalletOverview
const earnings = { totalEarned: 0, thisMonth: 0, pendingSales: 120 }

describe('walletBalances', () => {
  it('available is released sales plus store credit, the same sum the withdrawal page offers', () => {
    expect(walletBalances({ overview: overview({ available: 400, wallet: 25 }), earnings }).available).toBe(425)
  })

  it('never shows a balance below zero as available', () => {
    expect(walletBalances({ overview: overview({ available: -30 }), earnings }).available).toBe(0)
  })

  it('pending is every sale not yet available: in progress, plus completed and waiting for release', () => {
    expect(walletBalances({ overview: overview({ pending: 50 }), earnings }).pending).toBe(170)
    expect(pendingBalance(overview({ pending: 50 }), earnings)).toBe(170)
  })

  it('a failed earnings read shows no figure, not a false $0.00', () => {
    expect(walletBalances({ overview: overview(), earnings: null }).pending).toBeNull()
    expect(pendingBalance(null, earnings)).toBeNull()
  })

  it('says when pending money is next available, and otherwise where it comes from', () => {
    const soon = walletBalances({ overview: overview({ pending: 50, nextMaturityAt: '2026-11-08T12:00:00Z' }), earnings, timeZone: 'UTC' })
    expect(soon.pendingNote).toBe('Next available on Nov 8')
    expect(walletBalances({ overview: overview(), earnings }).pendingNote).toBe('From sales not yet completed')
  })
})

describe('balanceWarning', () => {
  it('names money stopped by a dispute', () => {
    expect(balanceWarning(overview({ frozen: 40 }))).toContain('$40.00')
  })
  it('explains a balance below zero first', () => {
    expect(balanceWarning(overview({ negative: true, frozen: 40 }))).toContain('below zero')
  })
  it('says nothing when all is well', () => {
    expect(balanceWarning(overview())).toBeNull()
  })
})
