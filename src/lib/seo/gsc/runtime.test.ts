import { describe, it, expect } from 'vitest'
import { isQuotaError } from './runtime'
import { GscHttpError, QuotaExhaustedError } from '../../../../scripts/lib/gsc/throttle'

describe('isQuotaError', () => {
  it("stops on Google's plain 'Quota exceeded' 429, not on other errors", () => {
    expect(isQuotaError(new GscHttpError(429, 'Search Console API HTTP 429: Quota exceeded for sc-domain:dropmarket.gg.'))).toBe(true)
    expect(isQuotaError(new QuotaExhaustedError('per day'))).toBe(true)
    expect(isQuotaError(new GscHttpError(500, 'server error'))).toBe(false)
    expect(isQuotaError(new GscHttpError(429, 'rate limited'))).toBe(false)
    expect(isQuotaError(new Error('x'))).toBe(false)
  })
})
