import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ELDORADO_USER_AGENT,
  EldoradoBlockedError,
  EldoradoHttpError,
  createEldoradoClient,
  isEldoradoBlocked,
  parseRetryAfter,
} from '../../../scripts/lib/eldorado-http.mjs'

/**
 * scripts/lib/eldorado-http.mjs — the one pacer + throttle rule every Eldorado
 * crawl goes through (2026-10-28/29: the SAB crawl burst ~12 requests per
 * brainrot, Eldorado answered 429 after ~60 brainrots and the whole feed was
 * thrown away). Every collaborator is injected: a fake clock that only moves
 * when the client sleeps, a scripted fetch, no network.
 */

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('eldorado-http tests must not touch the network — inject fetchImpl')
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

type Scripted = { status: number; body?: unknown; headers?: Record<string, string> } | Error

function harness(script: Scripted[], opts: Record<string, unknown> = {}) {
  let clock = 1_000_000
  const sleeps: number[] = []
  const starts: number[] = []
  const calls: { url: string; init: { headers: Record<string, string> } }[] = []
  const logs: string[] = []
  const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, init })
    starts.push(clock)
    const next = script.shift()
    if (!next) throw new Error('script exhausted')
    if (next instanceof Error) throw next
    return {
      status: next.status,
      ok: next.status >= 200 && next.status < 300,
      headers: new Headers(next.headers ?? {}),
      json: async () => next.body ?? {},
    }
  }
  const client = createEldoradoClient({
    // Only status / ok / headers / json are read: a partial Response.
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      clock += ms
    },
    now: () => clock,
    random: () => 0,
    log: (m: string) => logs.push(m),
    ...opts,
  })
  return { client, sleeps, starts, calls, logs, tick: (ms: number) => (clock += ms), now: () => clock }
}

const ok = (body: unknown = { ok: true }) => ({ status: 200, body })

describe('pacer', () => {
  it('starts every request at least minIntervalMs after the previous one', async () => {
    const h = harness([ok(), ok(), ok()], { minIntervalMs: 2000, jitterMs: 500 })
    for (let i = 0; i < 3; i += 1) await h.client.getJson('https://www.eldorado.gg/a')
    expect(h.starts.map((t) => t - h.starts[0])).toEqual([0, 2000, 4000])
  })

  it('adds the jitter on top of the interval', async () => {
    const h = harness([ok(), ok()], { minIntervalMs: 2000, jitterMs: 500, random: () => 0.999 })
    await h.client.getJson('https://www.eldorado.gg/a')
    await h.client.getJson('https://www.eldorado.gg/b')
    expect(h.starts[1] - h.starts[0]).toBe(2499)
  })

  it('does not bank idle time into a burst', async () => {
    const h = harness([ok(), ok(), ok()], { minIntervalMs: 2000, jitterMs: 0 })
    await h.client.getJson('https://www.eldorado.gg/a')
    h.tick(60_000)
    await h.client.getJson('https://www.eldorado.gg/b')
    await h.client.getJson('https://www.eldorado.gg/c')
    expect(h.starts[2] - h.starts[1]).toBe(2000)
  })

  it('queues concurrent callers one slot apart (slots reserved synchronously)', async () => {
    // A sleep that does not move the clock: what each caller was told to wait
    // shows the slot it reserved before any of them ran.
    const waits: number[] = []
    const h = harness([ok(), ok(), ok()], {
      minIntervalMs: 2000,
      jitterMs: 0,
      sleep: async (ms: number) => {
        waits.push(ms)
      },
    })
    await Promise.all(['a', 'b', 'c'].map((p) => h.client.getJson(`https://www.eldorado.gg/${p}`)))
    expect(waits).toEqual([2000, 4000])
  })

  it('sends one fixed browser User-Agent on every request (never rotated)', async () => {
    const h = harness([ok(), { status: 429 }, ok()], { jitterMs: 0 })
    await h.client.getJson('https://www.eldorado.gg/a')
    await h.client.getJson('https://www.eldorado.gg/b')
    expect(h.calls.map((c) => c.init.headers['user-agent'])).toEqual([
      ELDORADO_USER_AGENT,
      ELDORADO_USER_AGENT,
      ELDORADO_USER_AGENT,
    ])
  })
})

describe('throttle (429 / 403)', () => {
  it('honours Retry-After in seconds, slows the pace and retries the same request', async () => {
    const h = harness([{ status: 429, headers: { 'retry-after': '7' } }, ok({ page: 1 })], {
      minIntervalMs: 2000,
      jitterMs: 0,
    })
    await expect(h.client.getJson('https://www.eldorado.gg/p1')).resolves.toEqual({ page: 1 })
    expect(h.calls.map((c) => c.url)).toEqual(['https://www.eldorado.gg/p1', 'https://www.eldorado.gg/p1'])
    expect(h.sleeps).toContain(7000)
    expect(h.client.intervalMs).toBe(4000)
    expect(h.client.stats()).toMatchObject({ requests: 2, blocks: 1, cooldown_ms: 7000 })
  })

  it('honours Retry-After as an HTTP date', async () => {
    // The fake clock starts on a whole second, so the date round-trips exactly.
    const at = new Date(1_000_000 + 30_000).toUTCString()
    const h = harness([{ status: 429, headers: { 'retry-after': at } }, ok()], { jitterMs: 0 })
    await h.client.getJson('https://www.eldorado.gg/x')
    expect(h.sleeps[0]).toBe(30_000)
  })

  it('caps a long Retry-After at 120 s', async () => {
    const h = harness([{ status: 429, headers: { 'retry-after': '3600' } }, ok()], { jitterMs: 0 })
    await h.client.getJson('https://www.eldorado.gg/x')
    expect(h.sleeps[0]).toBe(120_000)
  })

  it('cools down 60 s when there is no Retry-After; 403 counts as a block too', async () => {
    const h = harness([{ status: 403 }, ok()], { jitterMs: 0 })
    await h.client.getJson('https://www.eldorado.gg/x')
    expect(h.sleeps[0]).toBe(60_000)
    expect(h.client.stats().blocks).toBe(1)
  })

  it('throws EldoradoBlockedError on the 2nd block in a row — no third attempt', async () => {
    const h = harness([{ status: 429 }, { status: 429 }, ok()], { jitterMs: 0 })
    const error = await h.client.getJson('https://www.eldorado.gg/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EldoradoBlockedError)
    expect(isEldoradoBlocked(error)).toBe(true)
    expect((error as EldoradoBlockedError).status).toBe(429)
    expect((error as Error).message).toMatch(/HTTP 429 again after a 60s cool-down.*stopped without bypassing the block/)
    expect(h.calls).toHaveLength(2)
  })

  it('a success resets the count: two separate blocks do not end the run', async () => {
    const h = harness([{ status: 429 }, ok(), { status: 429 }, ok()], { minIntervalMs: 2000, jitterMs: 0 })
    await h.client.getJson('https://www.eldorado.gg/a')
    await h.client.getJson('https://www.eldorado.gg/b')
    expect(h.client.stats().blocks).toBe(2)
    // Each block slows the pace again; capped at 4x the base interval.
    expect(h.client.intervalMs).toBe(8000)
  })

  it('caps the slow-down at 4x the base interval', async () => {
    const script: Scripted[] = []
    for (let i = 0; i < 4; i += 1) script.push({ status: 429 }, ok())
    const h = harness(script, { minIntervalMs: 2000, jitterMs: 0 })
    for (let i = 0; i < 4; i += 1) await h.client.getJson(`https://www.eldorado.gg/${i}`)
    expect(h.client.intervalMs).toBe(8000)
  })

  it('a 5xx between two blocks is not a recovery', async () => {
    const h = harness([{ status: 429 }, { status: 503 }, { status: 429 }], { jitterMs: 0 })
    await expect(h.client.getJson('https://www.eldorado.gg/x')).rejects.toBeInstanceOf(EldoradoBlockedError)
  })
})

describe('transient failures and other statuses', () => {
  it('retries a 5xx twice with backoff, then succeeds', async () => {
    const h = harness([{ status: 503 }, { status: 502 }, ok({ fine: true })], { jitterMs: 0 })
    await expect(h.client.getJson('https://www.eldorado.gg/x')).resolves.toEqual({ fine: true })
    expect(h.sleeps.slice(0, 2)).toEqual([5000, 10000])
    expect(h.client.stats().transient_retries).toBe(2)
  })

  it('gives up after 2 retries with a normal (not-blocked) error', async () => {
    const h = harness([{ status: 500 }, { status: 500 }, { status: 500 }, ok()], { jitterMs: 0 })
    const error = await h.client.getJson('https://www.eldorado.gg/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EldoradoHttpError)
    expect((error as EldoradoHttpError).status).toBe(500)
    expect(isEldoradoBlocked(error)).toBe(false)
    expect(h.calls).toHaveLength(3)
  })

  it('retries network errors and timeouts the same way', async () => {
    const h = harness([new TypeError('fetch failed'), ok({ fine: true })], { jitterMs: 0 })
    await expect(h.client.getJson('https://www.eldorado.gg/x')).resolves.toEqual({ fine: true })

    const h2 = harness([new TypeError('fetch failed'), new TypeError('fetch failed'), new Error('timeout')], {
      jitterMs: 0,
    })
    const error = await h2.client.getJson('https://www.eldorado.gg/x').catch((e: unknown) => e)
    expect((error as Error).message).toMatch(/Eldorado request failed \(timeout\)/)
    expect(isEldoradoBlocked(error)).toBe(false)
  })

  it('404 with optional → null; without → EldoradoHttpError, no retry', async () => {
    const h = harness([{ status: 404 }, { status: 404 }], { jitterMs: 0 })
    await expect(h.client.getJson('https://www.eldorado.gg/m', { optional: true })).resolves.toBeNull()
    await expect(h.client.getJson('https://www.eldorado.gg/m')).rejects.toBeInstanceOf(EldoradoHttpError)
    expect(h.calls).toHaveLength(2)
  })

  it('any other non-OK fails at once (no retry)', async () => {
    const h = harness([{ status: 400 }, ok()], { jitterMs: 0 })
    await expect(h.client.getJson('https://www.eldorado.gg/x')).rejects.toThrow(/HTTP 400/)
    expect(h.calls).toHaveLength(1)
  })
})

describe('every daily Eldorado crawler goes through the client (guard)', () => {
  // A private fetch is how a burst comes back: the old per-script fetchers had
  // no pacing between pages and three different 429 rules.
  const SHARED = /from ['"]\.\/(lib\/)?eldorado-http\.mjs['"]/
  it.each([
    'scripts/collect-eldorado-values.mjs',
    'scripts/collect-eldorado-sae.mjs',
    'scripts/collect-eldorado-popularity.mjs',
    'scripts/lib/adoptme-eldorado.mjs',
  ])('%s has no fetch of its own', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(SHARED)
    expect(src).not.toMatch(/\bfetch\(/)
  })
  it('the SAB collector: its only fetch() calls are Supabase ones', () => {
    const src = readFileSync('scripts/collect-eldorado-sab-api-v6.mjs', 'utf8')
    expect(src).toMatch(SHARED)
    expect(src).not.toMatch(/fetchEldoradoJson|user-agent/i)
    expect(src).not.toMatch(/HTTP \(403\|429\)/) // the old message-regex block check
  })
})

describe('parseRetryAfter', () => {
  const NOW = Date.parse('2026-10-29T08:32:00.000Z')
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('7', NOW)).toBe(7000)
    expect(parseRetryAfter('0', NOW)).toBe(0)
  })
  it('reads an HTTP date relative to now (past → 0)', () => {
    expect(parseRetryAfter('Thu, 29 Oct 2026 08:32:45 GMT', NOW)).toBe(45_000)
    expect(parseRetryAfter('Thu, 29 Oct 2026 08:00:00 GMT', NOW)).toBe(0)
  })
  it('ignores a missing or unreadable header', () => {
    expect(parseRetryAfter(null, NOW)).toBeNull()
    expect(parseRetryAfter('', NOW)).toBeNull()
    expect(parseRetryAfter('soon', NOW)).toBeNull()
  })
})
