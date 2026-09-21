/**
 * Unit tests for the rate-limit helper.
 *
 * The Postgres function is mocked by a faithful in-memory re-implementation of
 * its window arithmetic (floor(epoch / window) bucketing, count > limit), driven
 * by vitest's fake clock. That lets us prove the budget boundaries and the
 * window rollover deterministically, with no DB.
 *
 * The real function's atomicity is proven separately, in SQL, by the guard test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Counter store shared with the mocked RPC; reset per test. */
let store = new Map<string, number>()
/** When set, the RPC fails this way -- to exercise the fail-open path. */
let rpcError: string | null = null
let rpcThrow: Error | null = null
/** Every rpc() call, so we can assert on the arguments actually sent. */
let calls: Array<{ fn: string; args: Record<string, unknown> }> = []

/** Mirrors rate_limit_hit(): fixed epoch-derived buckets, returns count > limit. */
function fakeRateLimitHit(key: string, limit: number, windowSeconds: number): boolean {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds
  const bucket = `${key}@${windowStart}`
  const next = (store.get(bucket) ?? 0) + 1
  store.set(bucket, next)
  return next > limit
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      if (rpcThrow) throw rpcThrow
      if (rpcError) return { data: null, error: { message: rpcError } }
      return {
        data: fakeRateLimitHit(
          args.p_key as string,
          args.p_limit as number,
          args.p_window_seconds as number,
        ),
        error: null,
      }
    },
  }),
}))

import {
  checkRateLimit,
  checkRateLimitByIp,
  clientIp,
  rateLimitKey,
  rateLimitResponse,
  RATE_LIMITS,
} from './rate-limit'

/** Minimal stand-in for Headers / next/headers. */
const hdrs = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
})

beforeEach(() => {
  store = new Map()
  calls = []
  rpcError = null
  rpcThrow = null
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('clientIp — first hop of x-forwarded-for', () => {
  it('takes the FIRST hop, not the last', () => {
    // Vercel appends the real client as the leftmost entry; the trailing
    // entries are proxies. Reading the last hop would collapse every visitor
    // onto one key and effectively disable the limiter.
    expect(clientIp(hdrs({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })))
      .toBe('203.0.113.7')
  })

  it('trims whitespace around the hop', () => {
    expect(clientIp(hdrs({ 'x-forwarded-for': '  203.0.113.7  , 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('handles a single-hop header', () => {
    expect(clientIp(hdrs({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to "unknown"', () => {
    expect(clientIp(hdrs({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9')
    expect(clientIp(hdrs({}))).toBe('unknown')
  })

  it('ignores an empty x-forwarded-for and falls through', () => {
    expect(clientIp(hdrs({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.9' })))
      .toBe('198.51.100.9')
  })
})

describe('budget boundaries', () => {
  it('allows exactly `limit` requests, then limits the next one', async () => {
    const { limit } = RATE_LIMITS.contact // 5/min
    for (let i = 1; i <= limit; i++) {
      const r = await checkRateLimit('contact', 'ip:203.0.113.7')
      expect(r.limited, `request ${i} of ${limit} must be allowed`).toBe(false)
    }
    const over = await checkRateLimit('contact', 'ip:203.0.113.7')
    expect(over.limited).toBe(true)
    expect(over.retryAfter).toBe(60)
  })

  it('sends the documented budgets to the RPC', async () => {
    await checkRateLimit('auth', 'ip:1.1.1.1')
    await checkRateLimit('checkout', 'ip:1.1.1.1')
    await checkRateLimit('webhook', 'provider:coingate')
    await checkRateLimit('internal', 'ip:1.1.1.1')
    await checkRateLimit('contact', 'ip:1.1.1.1')

    expect(calls.map((c) => [c.args.p_key, c.args.p_limit, c.args.p_window_seconds])).toEqual([
      ['auth:ip:1.1.1.1', 10, 60],
      ['checkout:ip:1.1.1.1', 20, 60],
      ['webhook:provider:coingate', 120, 60],
      ['internal:ip:1.1.1.1', 30, 60],
      ['contact:ip:1.1.1.1', 5, 60],
    ])
    expect(calls.every((c) => c.fn === 'rate_limit_hit')).toBe(true)
  })

  it('matches the budgets named in the spec', () => {
    expect(RATE_LIMITS).toEqual({
      auth: { limit: 10, windowSeconds: 60 },
      checkout: { limit: 20, windowSeconds: 60 },
      webhook: { limit: 120, windowSeconds: 60 },
      internal: { limit: 30, windowSeconds: 60 },
      contact: { limit: 5, windowSeconds: 60 },
      // Step 7b — seller-triggered category revalidation (CPU a client spends).
      revalidate: { limit: 10, windowSeconds: 60 },
    })
  })
})

describe('window rollover (mocked clock)', () => {
  it('resets the budget once the window advances', async () => {
    for (let i = 0; i < RATE_LIMITS.contact.limit; i++) {
      await checkRateLimit('contact', 'ip:203.0.113.7')
    }
    expect((await checkRateLimit('contact', 'ip:203.0.113.7')).limited).toBe(true)

    // Cross into the next fixed window.
    vi.setSystemTime(new Date('2026-09-16T12:01:00.000Z'))
    expect((await checkRateLimit('contact', 'ip:203.0.113.7')).limited).toBe(false)
  })

  it('does NOT reset while still inside the same window', async () => {
    for (let i = 0; i < RATE_LIMITS.contact.limit; i++) {
      await checkRateLimit('contact', 'ip:203.0.113.7')
    }
    vi.setSystemTime(new Date('2026-09-16T12:00:59.999Z'))
    expect((await checkRateLimit('contact', 'ip:203.0.113.7')).limited).toBe(true)
  })
})

describe('key scoping', () => {
  it('separates budgets per IP', async () => {
    for (let i = 0; i < RATE_LIMITS.contact.limit; i++) {
      await checkRateLimit('contact', 'ip:203.0.113.7')
    }
    expect((await checkRateLimit('contact', 'ip:203.0.113.7')).limited).toBe(true)
    // A different visitor is unaffected.
    expect((await checkRateLimit('contact', 'ip:198.51.100.9')).limited).toBe(false)
  })

  it('separates budgets per route family for the same IP', async () => {
    for (let i = 0; i < RATE_LIMITS.contact.limit; i++) {
      await checkRateLimit('contact', 'ip:203.0.113.7')
    }
    expect((await checkRateLimit('contact', 'ip:203.0.113.7')).limited).toBe(true)
    // Burning the contact budget must not lock the same visitor out of checkout.
    expect((await checkRateLimit('checkout', 'ip:203.0.113.7')).limited).toBe(false)
  })

  it('separates webhook budgets per provider', async () => {
    for (let i = 0; i < RATE_LIMITS.webhook.limit; i++) {
      await checkRateLimit('webhook', 'provider:coingate')
    }
    expect((await checkRateLimit('webhook', 'provider:coingate')).limited).toBe(true)
    // One noisy provider must not throttle another provider's callbacks.
    expect((await checkRateLimit('webhook', 'provider:btcpay')).limited).toBe(false)
  })

  it('builds namespaced keys', () => {
    expect(rateLimitKey('auth', 'ip:203.0.113.7')).toBe('auth:ip:203.0.113.7')
  })

  it('checkRateLimitByIp derives the key from the first hop', async () => {
    const r = await checkRateLimitByIp('auth', hdrs({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))
    expect(r.key).toBe('auth:ip:203.0.113.7')
  })

  it('never charges an empty key', async () => {
    const r = await checkRateLimit('auth', '')
    expect(r.key).toBe('auth:unknown')
    expect(calls[0].args.p_key).toBe('auth:unknown')
  })
})

describe('fail-open', () => {
  it('allows the request when the RPC returns an error', async () => {
    rpcError = 'could not connect to server'
    const r = await checkRateLimit('checkout', 'ip:203.0.113.7')
    expect(r.limited).toBe(false)
    expect(r.retryAfter).toBe(60)
    expect(console.error).toHaveBeenCalled()
  })

  it('allows the request when the client throws', async () => {
    rpcThrow = new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    const r = await checkRateLimit('checkout', 'ip:203.0.113.7')
    expect(r.limited).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('treats a non-true RPC result as not limited', async () => {
    // A null/undefined payload must never be coerced into "limited".
    rpcError = null
    const r = await checkRateLimit('auth', 'ip:203.0.113.7')
    expect(r.limited).toBe(false)
  })
})

describe('rateLimitResponse', () => {
  it('is a 429 carrying Retry-After in seconds', async () => {
    const res = rateLimitResponse({ limited: true, retryAfter: 60, key: 'auth:ip:x' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(res.headers.get('cache-control')).toBe('no-store')
    await expect(res.json()).resolves.toMatchObject({ success: false })
  })

  it('carries a custom message when given one', async () => {
    const res = rateLimitResponse({ limited: true, retryAfter: 60, key: 'k' }, 'Slow down.')
    await expect(res.json()).resolves.toMatchObject({ error: 'Slow down.' })
  })
})
