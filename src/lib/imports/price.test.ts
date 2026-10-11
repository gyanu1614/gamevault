import { describe, it, expect } from 'vitest'
import { resolveImportPrice, HIGH_BAND, LOW_BAND } from './price'
import { PRICE_MIN } from '@/lib/listings/validate'

const market = (usd: number, estimated = false) => ({ usd, estimated, sampleSize: 5 })

describe('auto pricing — market price minus the undercut', () => {
  it('undercuts the market price by the batch percentage', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: market(10), undercutPct: 10, allowEstimated: false })
    expect(r).toMatchObject({ ok: true, price: 9, market: 10 })
  })

  it('uses the market price as-is at 0%', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: market(4.99), undercutPct: 0, allowEstimated: false })
    expect(r.ok && r.price).toBe(4.99)
  })

  it('rounds to whole cents, the unit a buyer is charged in', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: market(0.13), undercutPct: 10, allowEstimated: false })
    expect(r.ok && r.price).toBe(0.12)
  })

  it('never falls below the $0.01 floor the validator enforces', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: market(0.01), undercutPct: 90, allowEstimated: false })
    expect(r.ok && r.price).toBe(PRICE_MIN)
  })
})

describe('auto pricing — never invent a price', () => {
  it('REJECTS a row with no market price instead of guessing one', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: undefined, undercutPct: 10, allowEstimated: false })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toMatch(/no market price/i)
  })

  it('REJECTS a derived/estimated value by default', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: market(10, true), undercutPct: 10, allowEstimated: false })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toMatch(/estimate/i)
  })

  it('uses an estimated value only when the batch explicitly opted in, and says so', () => {
    const r = resolveImportPrice({ mode: 'auto', input: null, market: market(10, true), undercutPct: 10, allowEstimated: true })
    expect(r).toMatchObject({ ok: true, price: 9 })
    expect(r.ok && r.warning).toMatch(/estimate/i)
  })

  it('REJECTS a non-positive market price rather than producing a floor-priced listing', () => {
    for (const bad of [0, -1]) {
      const r = resolveImportPrice({ mode: 'auto', input: null, market: market(bad), undercutPct: 0, allowEstimated: false })
      expect(r.ok, `market ${bad}`).toBe(false)
    }
  })
})

describe('explicit pricing — the number is used, with a sanity check', () => {
  it('uses the given price as-is', () => {
    const r = resolveImportPrice({ mode: 'explicit', input: 7.5, market: market(10), undercutPct: 10, allowEstimated: false })
    expect(r).toMatchObject({ ok: true, price: 7.5 })
    expect(r.ok && r.warning).toBeUndefined()
  })

  it('warns — but still accepts — when far ABOVE the market', () => {
    const r = resolveImportPrice({ mode: 'explicit', input: 10 * HIGH_BAND + 1, market: market(10), undercutPct: 0, allowEstimated: false })
    expect(r.ok).toBe(true)
    expect(r.ok && r.warning).toMatch(/above the market/i)
  })

  it('warns — but still accepts — when far BELOW the market', () => {
    const r = resolveImportPrice({ mode: 'explicit', input: 10 * LOW_BAND - 0.5, market: market(10), undercutPct: 0, allowEstimated: false })
    expect(r.ok).toBe(true)
    expect(r.ok && r.warning).toMatch(/below the market/i)
  })

  it('does not warn inside the band', () => {
    for (const p of [10 * LOW_BAND, 10, 10 * HIGH_BAND]) {
      const r = resolveImportPrice({ mode: 'explicit', input: p, market: market(10), undercutPct: 0, allowEstimated: false })
      expect(r.ok && r.warning, `price ${p}`).toBeUndefined()
    }
  })

  it('accepts a price with no market to compare against, without a warning', () => {
    const r = resolveImportPrice({ mode: 'explicit', input: 3, market: undefined, undercutPct: 0, allowEstimated: false })
    expect(r).toMatchObject({ ok: true, price: 3, market: null })
    expect(r.ok && r.warning).toBeUndefined()
  })

  it('compares against an estimated market without needing the opt-in — it is only a warning', () => {
    const r = resolveImportPrice({ mode: 'explicit', input: 100, market: market(10, true), undercutPct: 0, allowEstimated: false })
    expect(r.ok).toBe(true)
    expect(r.ok && r.warning).toMatch(/above the market/i)
  })

  it('REJECTS a missing, zero, negative or non-finite number', () => {
    for (const bad of [null, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = resolveImportPrice({ mode: 'explicit', input: bad as number | null, market: market(10), undercutPct: 0, allowEstimated: false })
      expect(r.ok, `input ${bad}`).toBe(false)
    }
  })
})
