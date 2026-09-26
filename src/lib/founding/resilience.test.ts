/**
 * Tests for the /founding server-side degradation seam.
 *
 * Why: JAVASCRIPT-NEXTJS-5 (16 Sep 2026) — a founder opened their magic link
 * in the Google app's webview, a fetch failed with "TypeError: Load failed",
 * and the whole page escalated to app/error.tsx. The founder saw the generic
 * global error screen instead of their HQ.
 *
 * getFoundingHqData() fans out across several independent Supabase reads. Most
 * of them are ENRICHMENT (join number, journey progress, the profile chip) —
 * losing one should cost that one detail, not the page. Only a failure that
 * leaves nothing renderable should reach the route boundary.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { optional, required, FoundingDataError } from './resilience'

afterEach(() => {
  vi.restoreAllMocks()
})

function loadFailed() {
  return new TypeError('Load failed')
}

describe('optional', () => {
  it('passes the value through when the read succeeds', async () => {
    await expect(optional(() => Promise.resolve(42), 0, 'joinNumber')).resolves.toBe(42)
  })

  it('degrades to the fallback instead of throwing the page away', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // The regression: before the fix this rejection propagated out of the
    // server component and rendered app/error.tsx.
    await expect(optional(() => Promise.reject(loadFailed()), null, 'journey')).resolves.toBeNull()
  })

  it('degrades on a non-network failure too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      optional(() => Promise.reject(new Error('permission denied')), 'fb', 'profile'),
    ).resolves.toBe('fb')
  })

  it('labels the degraded read so it stays traceable in logs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await optional(() => Promise.reject(loadFailed()), null, 'founding:journey')
    expect(warn.mock.calls[0].join(' ')).toContain('founding:journey')
  })
})

describe('required', () => {
  it('passes the value through when the read succeeds', async () => {
    await expect(required(() => Promise.resolve('row'), 'founder')).resolves.toBe('row')
  })

  it('rethrows as a FoundingDataError so the route boundary can retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(required(() => Promise.reject(loadFailed()), 'founder')).rejects.toBeInstanceOf(
      FoundingDataError,
    )
  })

  it('marks a transport failure as retryable and keeps the cause', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const cause = loadFailed()
    const err = await required(() => Promise.reject(cause), 'founder').catch((e) => e)

    expect(err).toBeInstanceOf(FoundingDataError)
    expect(err.retryable).toBe(true)
    expect(err.cause).toBe(cause)
  })

  it('marks a genuine defect as not retryable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = await required(
      () => Promise.reject(new TypeError('x.map is not a function')),
      'founder',
    ).catch((e) => e)

    expect(err.retryable).toBe(false)
  })
})
