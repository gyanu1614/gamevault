import { describe, it, expect } from 'vitest'
import { OBSERVED_PRICE_TTL_DAYS, evidenceSince, staleObservedKeys } from './adopt-me-expiry'

/**
 * 2026-10-14 audit: 29% of Adopt Me "observed" prices had no evidence that
 * day and were carried forward with no expiry — 189 of them since Oct 5 —
 * still labelled as live verified-seller prices. A price with no reputable
 * evidence for OBSERVED_PRICE_TTL_DAYS becomes an estimate (number kept).
 */
describe('Adopt Me observed-price expiry', () => {
  const row = (pet: string, variant: string, observed = true, cash: number | null = 10) => ({
    pet_id: pet, variant, is_estimated: !observed, cash_value_usd: cash,
  })

  it('expires observed prices with no recent evidence; keeps the rest', () => {
    const rows = [row('bat', 'MFR'), row('bat', 'FR'), row('owl', 'FR', false), row('owl', 'NFR', true, null)]
    const evidence = new Set(['bat:FR'])
    expect(staleObservedKeys(rows, evidence)).toEqual(['bat:MFR'])
  })

  it('looks back a fixed window of days', () => {
    expect(OBSERVED_PRICE_TTL_DAYS).toBe(3)
    expect(evidenceSince('2026-10-15T02:10:00.000Z')).toBe('2026-10-12')
  })
})
