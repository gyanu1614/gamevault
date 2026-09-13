import { describe, expect, it } from 'vitest'

import { isRetryableImportError } from '../../../scripts/import-sab-market-json.mjs'

/**
 * ROUTE-011. The final publish:true call re-aggregates the whole dataset
 * server-side and runs exactly once per crawl, at the very end. Failing it threw
 * away a crawl that had already succeeded — three of the last 25 scheduled runs
 * died there with "canceling statement due to statement timeout" / "Gateway
 * Timeout". These pin which failures earn a retry.
 */
describe('isRetryableImportError', () => {
  it('retries a statement timeout surfaced in details', () => {
    expect(
      isRetryableImportError({
        status: 500,
        details: 'canceling statement due to statement timeout',
        message: 'eldorado import failed: canceling statement…',
      }),
    ).toBe(true)
  })

  it('retries the raw 57014 code', () => {
    expect(isRetryableImportError({ details: '57014' })).toBe(true)
  })

  it('retries a gateway timeout', () => {
    expect(
      isRetryableImportError({
        status: 504,
        message: 'eldorado import failed: Gateway Timeout',
      }),
    ).toBe(true)
  })

  it('retries 5xx, 408 and 429', () => {
    expect(isRetryableImportError({ status: 502 })).toBe(true)
    expect(isRetryableImportError({ status: 408 })).toBe(true)
    expect(isRetryableImportError({ status: 429 })).toBe(true)
  })

  it('does NOT retry an auth failure — the secret will not fix itself', () => {
    expect(
      isRetryableImportError({ status: 401, message: 'Unauthorized' }),
    ).toBe(false)
  })

  it('does NOT retry a validation error', () => {
    expect(
      isRetryableImportError({
        status: 400,
        message: 'source_slug is not supported',
      }),
    ).toBe(false)
  })
})
