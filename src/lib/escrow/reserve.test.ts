import { describe, it, expect } from 'vitest'
import { reserveForOrder } from '@/lib/escrow/reserve'
import { WARRANTY_TIERS, DAYS } from '@/lib/escrow/windows'

describe('reserveForOrder: crypto is dormant', () => {
  it('chargebackRisk=false → always 0% / 0 hold, regardless of category', () => {
    for (const cat of ['currency', 'codes', 'accounts', 'coaching'] as const) {
      expect(reserveForOrder(false, cat)).toEqual({ pct: 0, holdSeconds: 0 })
    }
  })
})

describe('reserveForOrder: cards activate the engine', () => {
  it('accounts use the warranty tier reserve', () => {
    const std = reserveForOrder(true, 'accounts', 'standard')
    expect(std.pct).toBe(WARRANTY_TIERS.standard.reservePct) // 0.10
    expect(std.holdSeconds).toBe(WARRANTY_TIERS.standard.reserveHoldMs / 1000) // 30d in s

    const prem = reserveForOrder(true, 'accounts', 'premium')
    expect(prem.pct).toBe(0.12)
    expect(prem.holdSeconds).toBe(WARRANTY_TIERS.premium.reserveHoldMs / 1000)
  })

  it('currency/coaching default to 15% / 180d (new-seller baseline)', () => {
    expect(reserveForOrder(true, 'currency')).toEqual({ pct: 0.15, holdSeconds: (180 * DAYS(1)) / 1000 })
    expect(reserveForOrder(true, 'coaching')).toEqual({ pct: 0.15, holdSeconds: (180 * DAYS(1)) / 1000 })
  })

  it('codes default to 5% / 90d', () => {
    expect(reserveForOrder(true, 'codes')).toEqual({ pct: 0.05, holdSeconds: (90 * DAYS(1)) / 1000 })
  })

  it('accounts defaults to standard tier when none given', () => {
    expect(reserveForOrder(true, 'accounts').pct).toBe(0.1)
  })
})
