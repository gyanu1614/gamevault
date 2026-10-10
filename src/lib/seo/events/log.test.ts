import { describe, it, expect, vi } from 'vitest'
import { MAX_ATTEMPTS, nextAttemptDelayMinutes, recordUrlEvents, sendDueEvents, type UrlEventStore } from './log'
import type { ChunkResult } from '@/lib/seo/indexnow/submit'

const SITE = 'https://dropmarket.gg'
const NOW = '2026-10-09T12:00:00.000Z'

function memoryStore() {
  let id = 0
  const rows: { id: number; url: string; reason: string; status: string; attempts: number; next: string; error?: string; sentAt?: string }[] = []
  const store: UrlEventStore = {
    async insert(items) {
      for (const r of items) rows.push({ id: ++id, ...r, status: 'pending', attempts: 0, next: NOW })
    },
    async due(limit, now) {
      return rows.filter((r) => r.status === 'pending' && r.next <= now).slice(0, limit).map(({ id, url, reason, attempts }) => ({ id, url, reason, attempts }))
    },
    async markSent(ids, at) {
      for (const r of rows) if (ids.includes(r.id)) Object.assign(r, { status: 'sent', sentAt: at, attempts: r.attempts + 1 })
    },
    async markRetry(updates) {
      for (const u of updates) Object.assign(rows.find((r) => r.id === u.id)!, { attempts: u.attempts, next: u.nextAttemptAt, error: u.error })
    },
    async markFailed(updates) {
      for (const u of updates) Object.assign(rows.find((r) => r.id === u.id)!, { status: 'failed', attempts: u.attempts, error: u.error })
    },
  }
  return { store, rows }
}
const ok = (): ChunkResult => ({ ok: true, status: 202, retryAfterSec: null, error: null })
const fail = (status: number | null, retryAfterSec: number | null = null): ChunkResult => ({ ok: false, status, retryAfterSec, error: `HTTP ${status}` })

describe('recordUrlEvents', () => {
  it('writes one row per canonical URL on the site, with the reason', async () => {
    const { store, rows } = memoryStore()
    const r = await recordUrlEvents(['/adopt-me/values/bat-dragon', '/adopt-me/values/bat-dragon/', 'https://evil.example/x'], 'value-change:adopt-me', { store, siteUrl: SITE })
    expect(r).toEqual({ recorded: 1, error: null })
    expect(rows.map((x) => [x.url, x.reason])).toEqual([[`${SITE}/adopt-me/values/bat-dragon`, 'value-change:adopt-me']])
  })

  it('never throws: a failed write is reported, not raised', async () => {
    const store = { insert: vi.fn(async () => { throw new Error('db down') }) } as unknown as UrlEventStore
    const log = vi.fn()
    const r = await recordUrlEvents(['/a'], 'x', { store, siteUrl: SITE, log })
    expect(r).toEqual({ recorded: 0, error: 'db down' })
    expect(log).toHaveBeenCalled()
  })
})

describe('sendDueEvents', () => {
  it('sends nothing outside production', async () => {
    const { store } = memoryStore()
    await recordUrlEvents(['/a'], 'x', { store, siteUrl: SITE })
    const post = vi.fn(async () => ok())
    const r = await sendDueEvents({ store, post, now: NOW, production: false })
    expect(post).not.toHaveBeenCalled()
    expect(r.skipped).toBe('not-production')
  })

  it('sends each URL once even when several triggers logged it, and marks every row sent', async () => {
    const { store, rows } = memoryStore()
    await recordUrlEvents(['/a', '/b'], 'listing-published', { store, siteUrl: SITE })
    await recordUrlEvents(['/a'], 'value-change:x', { store, siteUrl: SITE })
    const post = vi.fn(async (_urls: string[]) => ok())
    const r = await sendDueEvents({ store, post, now: NOW, production: true })
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][0]).toEqual([`${SITE}/a`, `${SITE}/b`])
    expect(r).toMatchObject({ sent: 3, retried: 0, failed: 0, urls: 2 })
    expect(rows.every((x) => x.status === 'sent' && x.sentAt === NOW)).toBe(true)
  })

  it('sends in chunks of at most 100 URLs', async () => {
    const { store } = memoryStore()
    await recordUrlEvents(Array.from({ length: 250 }, (_, i) => `/p${i}`), 'x', { store, siteUrl: SITE })
    const post = vi.fn(async (_urls: string[]) => ok())
    await sendDueEvents({ store, post, now: NOW, production: true })
    expect(post.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50])
  })

  it('retries a failed chunk later with backoff, honouring Retry-After', async () => {
    const { store, rows } = memoryStore()
    await recordUrlEvents(['/a'], 'x', { store, siteUrl: SITE })
    await sendDueEvents({ store, post: async () => fail(503), now: NOW, production: true })
    expect(rows[0]).toMatchObject({ status: 'pending', attempts: 1, next: '2026-10-09T12:05:00.000Z' })
    // Not due yet: not sent again.
    const post = vi.fn(async () => ok())
    await sendDueEvents({ store, post, now: NOW, production: true })
    expect(post).not.toHaveBeenCalled()
    await sendDueEvents({ store, post: async () => fail(429, 3600), now: '2026-10-09T12:05:00.000Z', production: true })
    expect(rows[0]).toMatchObject({ attempts: 2, next: '2026-10-09T13:05:00.000Z' })
  })

  it('gives up after the last attempt, and at once on a 422 (URL rejected)', async () => {
    const { store, rows } = memoryStore()
    await recordUrlEvents(['/a'], 'x', { store, siteUrl: SITE })
    rows[0].attempts = MAX_ATTEMPTS - 1
    await sendDueEvents({ store, post: async () => fail(500), now: NOW, production: true })
    expect(rows[0]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS })
    await recordUrlEvents(['/b'], 'x', { store, siteUrl: SITE })
    await sendDueEvents({ store, post: async () => fail(422), now: NOW, production: true })
    expect(rows[1]).toMatchObject({ status: 'failed', attempts: 1 })
  })

  it('backs off 5 min, 30 min, 2 h, 12 h, then a day', () => {
    expect([1, 2, 3, 4, 5].map((a) => nextAttemptDelayMinutes(a, null))).toEqual([5, 30, 120, 720, 1440])
    expect(nextAttemptDelayMinutes(1, 600)).toBe(10)
  })
})

describe('recordAndFlush', () => {
  it('logs and delivers at once in production; a failed delivery stays pending for the cron', async () => {
    const { recordAndFlush } = await import('./log')
    const { store, rows } = memoryStore()
    const r = await recordAndFlush(['/a'], 'listing-published', { store, production: true, now: NOW, post: async () => fail(503) })
    expect(r).toEqual({ recorded: 1, error: null, sent: 0 })
    expect(rows[0]).toMatchObject({ status: 'pending', attempts: 1 })
    const ok2 = await recordAndFlush(['/b'], 'listing-published', { store, production: true, now: '2026-10-09T12:06:00.000Z', post: async () => ok() })
    // The earlier pending row is due again by then, so both go out.
    expect(ok2.sent).toBe(2)
  })

  it('does not deliver outside production', async () => {
    const { recordAndFlush } = await import('./log')
    const { store, rows } = memoryStore()
    const post = vi.fn(async () => ok())
    const r = await recordAndFlush(['/a'], 'x', { store, production: false, now: NOW, post })
    expect(post).not.toHaveBeenCalled()
    expect(r).toEqual({ recorded: 1, error: null, sent: 0 })
    expect(rows[0].status).toBe('pending')
  })
})
