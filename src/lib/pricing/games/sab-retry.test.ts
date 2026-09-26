import { describe, expect, it } from 'vitest'

import { isRetryableReadError } from './sab'

/**
 * ROUTE-011. The correction run reads ~111 pages of sab_market_raw_listings.
 * Any page can intermittently exceed the Postgres statement timeout (57014)
 * depending on cache warmth, and selectAll previously threw on the first such
 * failure — aborting the run that is the ONLY writer of sab_price_display.
 * These pin down which failures are worth a retry and, just as importantly,
 * which must still fail fast.
 */
describe('isRetryableReadError', () => {
  it('retries the Postgres statement timeout by code', () => {
    expect(isRetryableReadError({ code: '57014' })).toBe(true)
  })

  it('retries the statement timeout by message, as PostgREST returns it', () => {
    expect(
      isRetryableReadError({
        message: 'canceling statement due to statement timeout',
      }),
    ).toBe(true)
  })

  it('retries transient network failures', () => {
    expect(isRetryableReadError({ message: 'fetch failed' })).toBe(true)
    expect(isRetryableReadError({ message: 'ECONNRESET' })).toBe(true)
    expect(isRetryableReadError({ message: 'EAI_AGAIN' })).toBe(true)
  })

  it('does NOT retry a schema error — retrying cannot help', () => {
    expect(
      isRetryableReadError({
        code: '42703',
        message: 'column sab_market_raw_listings.nope does not exist',
      }),
    ).toBe(false)
  })

  it('does NOT retry a permission error', () => {
    expect(
      isRetryableReadError({
        code: '42501',
        message: 'permission denied for table sab_market_raw_listings',
      }),
    ).toBe(false)
  })

  it('treats an empty error as non-retryable rather than looping', () => {
    expect(isRetryableReadError({})).toBe(false)
  })
})
