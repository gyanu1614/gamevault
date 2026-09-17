/**
 * Tests for the background-fetch degradation helpers.
 *
 * These exist because of two real Sentry events on 16 Sep 2026, both
 * "TypeError: Load failed" (WebKit's opaque fetch network error) from iPhones:
 *
 *  (B) the homepage navbar fired `getMyStorePaused().then(...)` at mount with
 *      no `.catch()`. On a flaky mobile connection the server-action POST
 *      rejected, nothing handled it, and it reached Sentry as an
 *      `onunhandledrejection` (handled=no) — a background hydration nobody
 *      asked for, reported as a hard error.
 *
 * The rule these helpers encode: a background fetch that only *enriches* the
 * UI must degrade to a fallback and a log, never reject into the void and
 * never escalate to an error boundary.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeBackground, isNetworkError } from './safe-background'

afterEach(() => {
  vi.restoreAllMocks()
})

/** WebKit's network failure: a bare TypeError with an opaque message. */
function loadFailed() {
  return new TypeError('Load failed')
}

describe('isNetworkError', () => {
  it('recognises the WebKit and Chromium fetch failures', () => {
    expect(isNetworkError(loadFailed())).toBe(true)
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true)
  })

  it('recognises an aborted request', () => {
    const err = new Error('The operation was aborted.')
    err.name = 'AbortError'
    expect(isNetworkError(err)).toBe(true)
  })

  it('does not swallow a genuine programming error', () => {
    expect(isNetworkError(new TypeError("undefined is not a function"))).toBe(false)
    expect(isNetworkError(new Error('permission denied for table profiles'))).toBe(false)
  })

  it('tolerates non-Error rejection values', () => {
    expect(isNetworkError('Load failed')).toBe(true)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})

describe('safeBackground', () => {
  it('resolves to the value when the work succeeds', async () => {
    await expect(safeBackground(() => Promise.resolve('ok'), 'fallback')).resolves.toBe('ok')
  })

  it('resolves to the fallback instead of rejecting on a network failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // The regression: this must NOT reject. Before the fix the equivalent
    // call produced an unhandled rejection reported as "TypeError: Load failed".
    await expect(safeBackground(() => Promise.reject(loadFailed()), false)).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('resolves to the fallback when the work throws synchronously', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      safeBackground(() => {
        throw loadFailed()
      }, null),
    ).resolves.toBeNull()
  })

  it('never produces an unhandled rejection for a failing call', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    // Call it the way the navbar does — fire-and-forget, no caller `.catch()`.
    void safeBackground(() => Promise.reject(loadFailed()), null)
    await new Promise((r) => setTimeout(r, 10))

    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('logs a label so a degraded background load is still traceable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await safeBackground(() => Promise.reject(loadFailed()), null, 'navbar:storePaused')
    expect(warn.mock.calls[0].join(' ')).toContain('navbar:storePaused')
  })

  it('still degrades (does not rethrow) on a non-network error', async () => {
    // A background enrichment must not break the page for ANY reason; the
    // distinction from isNetworkError only governs how loudly we log.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(safeBackground(() => Promise.reject(new Error('boom')), 'fb')).resolves.toBe('fb')
    expect(err).toHaveBeenCalled()
  })
})
