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

/**
 * ROUTE-013. The real failure: a full-refresh SQL function did an unqualified
 * DELETE, safe-update mode rejected it with SQLSTATE 21000, the edge function
 * reported that as its own HTTP 500, and the retry loop re-sent the identical
 * doomed statement four times. Status alone cannot classify these — the import
 * endpoint wraps every RPC failure in a 500 — so the SQLSTATE has to win.
 */
describe('isRetryableImportError — ROUTE-013 permanent errors', () => {
  it('does NOT retry the safe-update DELETE guard, even as a 500', () => {
    expect(
      isRetryableImportError({
        status: 500,
        details: 'DELETE requires a WHERE clause',
        message: 'eldorado import failed: DELETE requires a WHERE clause',
      }),
    ).toBe(false)
  })

  it('does NOT retry it by SQLSTATE either', () => {
    expect(
      isRetryableImportError({ status: 500, details: '21000' }),
    ).toBe(false)
  })

  it('does NOT retry the UPDATE form of the same guard', () => {
    expect(
      isRetryableImportError({
        status: 500,
        details: 'UPDATE requires a WHERE clause',
      }),
    ).toBe(false)
  })

  it('does NOT retry schema/permission errors wrapped in a 500', () => {
    for (const details of [
      '42703 column does not exist',
      '42P01 relation does not exist',
      '42883 function does not exist',
      '42501 permission denied',
      '23505 duplicate key value violates unique constraint',
    ]) {
      expect(isRetryableImportError({ status: 500, details })).toBe(false)
    }
  })

  it('does NOT retry a PostgREST schema-cache error', () => {
    expect(
      isRetryableImportError({
        status: 500,
        details: 'PGRST202 Could not find the function in the schema cache',
      }),
    ).toBe(false)
  })

  it('still retries a genuine statement timeout reported as a 500', () => {
    expect(
      isRetryableImportError({
        status: 500,
        details: 'canceling statement due to statement timeout',
      }),
    ).toBe(true)
  })

  it('still retries a bare 5xx with no SQLSTATE', () => {
    expect(isRetryableImportError({ status: 503 })).toBe(true)
  })

  it('does NOT retry a generic 4xx', () => {
    expect(isRetryableImportError({ status: 400 })).toBe(false)
    expect(isRetryableImportError({ status: 403 })).toBe(false)
    expect(isRetryableImportError({ status: 422 })).toBe(false)
  })

  it('still retries the two 4xx that mean "try again"', () => {
    expect(isRetryableImportError({ status: 408 })).toBe(true)
    expect(isRetryableImportError({ status: 429 })).toBe(true)
  })
})

/**
 * ROUTE-017 (3). A malformed `listing_url` surfaces as the bare
 * `TypeError: Invalid URL` from `new URL()` — no HTTP status, no SQLSTATE — so
 * the predicate recognised neither and it fell through to the final
 * `return status >= 500`. A bare one was rejected only by luck (`0 >= 500` is
 * false); the same message wrapped in a 5xx, or arriving under a 429, would
 * have been re-sent 4x over ~20s for a row that can never parse.
 *
 * It is permanent by IDENTITY, like ROUTE-013's SQLSTATEs — so it must be
 * classified before the status is ever consulted.
 */
describe('isRetryableImportError — ROUTE-017 Invalid URL is permanent', () => {
  it('does NOT retry a bare Invalid URL TypeError', () => {
    expect(
      isRetryableImportError({ message: 'TypeError: Invalid URL' }),
    ).toBe(false)
  })

  it('does NOT retry it when wrapped in a 500 — status must not win', () => {
    expect(
      isRetryableImportError({
        status: 500,
        details: 'Invalid URL',
        message: 'eldorado import failed: Invalid URL',
      }),
    ).toBe(false)
  })

  it('does NOT retry it under 408 or 429 either', () => {
    expect(
      isRetryableImportError({ status: 408, details: 'Invalid URL' }),
    ).toBe(false)
    expect(
      isRetryableImportError({ status: 429, details: 'Invalid URL' }),
    ).toBe(false)
  })

  it('matches case-insensitively, as the runtime capitalises it differently', () => {
    expect(isRetryableImportError({ details: 'invalid url' })).toBe(false)
    expect(isRetryableImportError({ details: 'INVALID URL' })).toBe(false)
  })

  it('keys on the PHRASE, not on "url" appearing anywhere', () => {
    // A transient failure whose text merely happens to contain a URL must
    // still retry — otherwise this guard would silently disable the retry
    // that ROUTE-011 exists to provide.
    expect(
      isRetryableImportError({
        status: 500,
        details:
          'canceling statement due to statement timeout while calling https://example.supabase.co/rest/v1/x',
      }),
    ).toBe(true)
    expect(
      isRetryableImportError({
        status: 504,
        message: 'fetch failed for url https://example.com',
      }),
    ).toBe(true)
  })
})
