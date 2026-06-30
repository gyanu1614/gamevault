import { describe, it, expect } from 'vitest'
import {
  HOURS,
  DAYS,
  WINDOWS,
  WARRANTY_TIERS,
  DEFAULT_WARRANTY_TIER,
  windowFor,
  assertWarrantyInvariants,
} from '@/lib/escrow/windows'

describe('windows: non-account categories (decided 2026-06-28)', () => {
  it('currency: 12h post-confirm delay, 3-day auto-release, from delivery', () => {
    expect(WINDOWS.currency.postConfirmDelayMs).toBe(HOURS(12))
    expect(WINDOWS.currency.autoReleaseMs).toBe(DAYS(3))
    expect(WINDOWS.currency.startsAt).toBe('delivered')
  })
  it('codes: single 24h window, no confirm buffer', () => {
    expect(WINDOWS.codes.postConfirmDelayMs).toBe(0)
    expect(WINDOWS.codes.autoReleaseMs).toBe(HOURS(24))
  })
  it('coaching: 3h confirm buffer, completion + 5 days, from completion', () => {
    expect(WINDOWS.coaching.postConfirmDelayMs).toBe(HOURS(3))
    expect(WINDOWS.coaching.autoReleaseMs).toBe(DAYS(5))
    expect(WINDOWS.coaching.startsAt).toBe('completed')
  })
})

describe('windows: account warranty tiers', () => {
  it('standard (default, free) = 7-day window', () => {
    expect(DEFAULT_WARRANTY_TIER).toBe('standard')
    expect(WARRANTY_TIERS.standard.windowMs).toBe(DAYS(7))
    expect(WARRANTY_TIERS.standard.buyerFeePct).toBe(0)
  })
  it('extended = 14 days, +4%', () => {
    expect(WARRANTY_TIERS.extended.windowMs).toBe(DAYS(14))
    expect(WARRANTY_TIERS.extended.buyerFeePct).toBe(0.04)
  })
  it('premium = 30 days, +6%', () => {
    expect(WARRANTY_TIERS.premium.windowMs).toBe(DAYS(30))
    expect(WARRANTY_TIERS.premium.buyerFeePct).toBe(0.06)
  })
})

describe('windows: resolver', () => {
  it('windowFor(accounts, tier) reads the tier window', () => {
    expect(windowFor('accounts', 'premium').autoReleaseMs).toBe(DAYS(30))
    expect(windowFor('accounts').autoReleaseMs).toBe(DAYS(7)) // default standard
  })
  it('windowFor(currency) reads the fixed config', () => {
    expect(windowFor('currency').autoReleaseMs).toBe(DAYS(3))
  })
})

describe('windows: warranty invariant (reserve hold >= protection window)', () => {
  it('holds for every tier — auto-release never beats the cover', () => {
    expect(() => assertWarrantyInvariants()).not.toThrow()
    for (const cfg of Object.values(WARRANTY_TIERS)) {
      expect(cfg.reserveHoldMs).toBeGreaterThanOrEqual(cfg.windowMs)
    }
  })
})
