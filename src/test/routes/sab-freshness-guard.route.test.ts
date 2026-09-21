/**
 * ROUTE-014 — the SAB freshness guard.
 *
 * The pipeline reads snapshots at three hops now, so any hop can stop advancing
 * while the layers above it keep serving the last good data. That already
 * happened: sab_price_display froze at 2026-08-14 for a month while the values
 * pages showed a confident "Updated" date, because the refresh RPC was failing
 * and its caller logged the failure as non-fatal (ROUTE-010/013).
 *
 * These tests pin the two properties that make the guard useful:
 *   1. staleness is judged at 2x each hop's cadence — one missed crawl is not an
 *      alert, a stopped hop is;
 *   2. a missing signal (empty table, failed read, garbage timestamp) counts as
 *      STALE, never as a pass — "no timestamp" silently passing is the exact bug
 *      shape being guarded against.
 *
 * The route is exercised through mocked Supabase and email clients: the guard's
 * value is its decision logic and its non-200, neither of which needs a DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Email must never reach the real provider from a test run (CLAUDE.md; the
// transport guard throws if it does). Mocked here so the route's alert path is
// observable without a send.
vi.mock('@/lib/email', () => ({
  sendAdminNoticeEmail: vi.fn(async () => ({ success: true, data: { id: 'mock' } })),
}))

const latestByTable = new Map<string, { value: string | null; error?: string }>()
/**
 * Unrepriced-key counts per RPC for the partial-freeze check. Defaults to 0 so
 * the existing max()-only cases keep asserting exactly what they always did.
 */
const unrepricedByRpc = new Map<string, { count: number | null; error?: string }>()
/** Every rpc() call the route makes, so a test can pin the grace it passes. */
const rpcCalls: { name: string; args: Record<string, unknown> }[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    // The partial-freeze question is answered by sab_count_unrepriced(), a
    // per-key "is the evidence newer than the price?" — not a row-age count.
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      const entry = unrepricedByRpc.get(name) ?? { count: 0 }
      return entry.error
        ? { data: null, error: { message: entry.error } }
        : { data: entry.count, error: null }
    },
    from(table: string) {
      const builder: any = {
        // 2026-09-20: counting rows by AGE was the bug. With incremental
        // writes, price_updated_at only moves for items the crawl visited, so
        // an age count alerted on every run (1584 → 688 rows) while the reprice
        // it watched was green. Any regression to a head-count here must fail
        // loudly rather than quietly re-arm that alert.
        select: (_col?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            throw new Error(
              'row-age count is not the guard\'s question — use sab_count_unrepriced()',
            )
          }
          return builder
        },
        order: () => builder,
        limit: async () => {
          const entry = latestByTable.get(table)
          if (!entry) throw new Error(`test did not stub table: ${table}`)
          if (entry.error) return { data: null, error: { message: entry.error } }
          // PostgREST returns [] for an empty table, not [{ col: null }].
          if (entry.value === null) return { data: [], error: null }
          const column =
            table === 'sab_price_display'
              ? 'price_updated_at'
              : table === 'sab_market_raw_listings'
                ? 'observed_at'
                : 'refreshed_at'
          return { data: [{ [column]: entry.value }], error: null }
        },
      }
      return builder
    },
  }),
}))

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/cron/check-sab-freshness/route'
import {
  evaluate,
  buildAlertBody,
  FRESHNESS_CHECKS,
  FRESHNESS_ALERT_EMAIL,
  type FreshnessCheck,
} from '@/app/api/cron/check-sab-freshness/freshness-checks'
import { sendAdminNoticeEmail } from '@/lib/email'

const SECRET = 'test-cron-secret'
const NOW = Date.parse('2026-09-13T12:00:00.000Z')
const HOUR = 3_600_000

/** All three hops fresh unless a test says otherwise. */
function stubAllFresh(ageHours = 1) {
  const at = new Date(NOW - ageHours * HOUR).toISOString()
  latestByTable.set('sab_market_evidence_display', { value: at })
  latestByTable.set('sab_price_display', { value: at })
  latestByTable.set('sab_market_raw_listings', { value: at })
}

function req(auth = `Bearer ${SECRET}`) {
  return new NextRequest('https://dropmarket.gg/api/cron/check-sab-freshness', {
    headers: auth ? { authorization: auth } : {},
  })
}

const check = (over: Partial<FreshnessCheck> = {}): FreshnessCheck => ({
  table: 'sab_price_display',
  column: 'price_updated_at',
  cadenceHours: 3,
  cadence: 'test',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  latestByTable.clear()
  unrepricedByRpc.clear()
  rpcCalls.length = 0
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('ROUTE-014 — freshness thresholds are 2x cadence', () => {
  it('watches all three hops of the pipeline', () => {
    expect(FRESHNESS_CHECKS.map((c) => `${c.table}.${c.column}`)).toEqual([
      'sab_market_evidence_display.refreshed_at',
      'sab_price_display.price_updated_at',
      'sab_market_raw_listings.observed_at',
    ])
  })

  it('derives the threshold as exactly 2x the declared cadence', () => {
    for (const c of FRESHNESS_CHECKS) {
      expect(evaluate(c, new Date(NOW).toISOString(), NOW).thresholdHours).toBe(
        c.cadenceHours * 2,
      )
    }
  })

  it('passes a snapshot refreshed one cadence ago (a single missed crawl is not an alert)', () => {
    const r = evaluate(check(), new Date(NOW - 3 * HOUR).toISOString(), NOW)
    expect(r.stale).toBe(false)
    expect(r.ageHours).toBe(3)
  })

  it('passes at exactly the threshold and fails just past it', () => {
    expect(evaluate(check(), new Date(NOW - 6 * HOUR).toISOString(), NOW).stale).toBe(false)
    expect(
      evaluate(check(), new Date(NOW - 6 * HOUR - 60_000).toISOString(), NOW).stale,
    ).toBe(true)
  })

  it('flags the month-long freeze that motivated this guard', () => {
    const r = evaluate(check(), '2026-08-14T01:46:00.000Z', Date.parse('2026-09-13T00:00:00.000Z'))
    expect(r.stale).toBe(true)
    expect(r.ageHours).toBeGreaterThan(24 * 29)
  })
})

describe('ROUTE-014 — a missing signal is stale, never a pass', () => {
  it('treats an empty table as stale', () => {
    const r = evaluate(check(), null, NOW)
    expect(r.stale).toBe(true)
    expect(r.ageHours).toBeNull()
  })

  it('treats a failed read as stale rather than healthy', () => {
    const r = evaluate(check(), null, NOW, 'permission denied for table')
    expect(r.stale).toBe(true)
    expect(r.error).toContain('permission denied')
  })

  it('treats an unparseable timestamp as stale', () => {
    const r = evaluate(check(), 'not-a-date', NOW)
    expect(r.stale).toBe(true)
    expect(r.error).toContain('unparseable')
  })

  it('does not treat a future timestamp as stale (clock skew is not staleness)', () => {
    expect(evaluate(check(), new Date(NOW + HOUR).toISOString(), NOW).stale).toBe(false)
  })
})

describe('ROUTE-014 — route behaviour', () => {
  it('rejects an unauthenticated request', async () => {
    stubAllFresh()
    expect((await GET(req(''))).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(sendAdminNoticeEmail).not.toHaveBeenCalled()
  })

  it('returns 200 and sends nothing when every hop is fresh', async () => {
    stubAllFresh(2)
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.results.every((r: any) => r.stale === false)).toBe(true)
    expect(sendAdminNoticeEmail).not.toHaveBeenCalled()
  })

  it('fails non-200 and emails admin@dropmarket.gg when a hop is stale', async () => {
    stubAllFresh(1)
    latestByTable.set('sab_price_display', {
      value: new Date(NOW - 40 * HOUR).toISOString(),
    })

    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.stale).toEqual(['sab_price_display'])
    expect(body.alert_emailed).toBe(true)

    expect(sendAdminNoticeEmail).toHaveBeenCalledTimes(1)
    const arg = (sendAdminNoticeEmail as any).mock.calls[0][0]
    expect(arg.to).toBe('admin@dropmarket.gg')
    expect(FRESHNESS_ALERT_EMAIL).toBe('admin@dropmarket.gg')
    expect(arg.subject).toContain('sab_price_display')
    expect(arg.bodyText).toContain('sab_price_display.price_updated_at')
  })

  it('fails on a PARTIAL freeze: every hop fresh, but the crawl outran the reprice', async () => {
    // The five-day outage, exactly. correct-prices 504'd on every crawl, yet
    // ~173 of 393 brainrots kept repricing — so max(price_updated_at) was
    // always minutes old and this route returned 200 while 214 brainrots
    // served Sep 14 prices. max() alone cannot see this. What CAN see it is the
    // per-key question "is there evidence newer than the price?": those 214
    // keys had fresh listings landing every crawl and a computed_at that never
    // followed.
    stubAllFresh(1)
    unrepricedByRpc.set('sab_count_unrepriced', { count: 214 })

    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.stale).toEqual(['sab_price_corrections'])
    // The max() checks must still all read as healthy — that is the point.
    expect(body.results.every((r: any) => r.stale === false)).toBe(true)
    expect(body.stale_counts[0].staleRows).toBe(214)

    const arg = (sendAdminNoticeEmail as any).mock.calls[0][0]
    expect(arg.bodyText).toContain('PARTIAL FREEZE')
    expect(arg.bodyText).toContain('newer than')
  })

  it('asks the per-key question with a grace window, never a row-age count', async () => {
    // 2026-09-20: the row-age version alerted every 3h on 688 rows / 70
    // brainrots that were simply not in the last crawl — incremental writes
    // leave their computed_at alone by design. Row age is "not crawled";
    // the guard's question is "crawled but not repriced". The grace keeps the
    // daily Vercel cron from flagging a crawl that is mid-import.
    stubAllFresh(1)

    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(rpcCalls).toEqual([
      { name: 'sab_count_unrepriced', args: { p_grace_seconds: 3600 } },
    ])
  })

  it('tolerates a few unrepriced laggards without alerting', async () => {
    // A key can legitimately lag by a run (a listing observed by the G2G
    // cross-check between crawls); the threshold keeps those from paging.
    stubAllFresh(1)
    unrepricedByRpc.set('sab_count_unrepriced', { count: 25 })

    const res = await GET(req())
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(sendAdminNoticeEmail).not.toHaveBeenCalled()
  })

  it('fails when the unrepriced count itself cannot be read', async () => {
    stubAllFresh(1)
    unrepricedByRpc.set('sab_count_unrepriced', {
      count: null,
      error: '57014 statement timeout',
    })

    const res = await GET(req())
    expect(res.status).toBe(500)
    expect((await res.json()).stale_counts[0].error).toContain('57014')
  })

  it('reports every stale hop, not just the first', async () => {
    const old = new Date(NOW - 40 * HOUR).toISOString()
    latestByTable.set('sab_market_evidence_display', { value: old })
    latestByTable.set('sab_price_display', { value: old })
    latestByTable.set('sab_market_raw_listings', { value: new Date(NOW - HOUR).toISOString() })

    const body = await (await GET(req())).json()
    expect(body.stale).toEqual(['sab_market_evidence_display', 'sab_price_display'])
  })

  it('fails non-200 when the freshness read itself errors', async () => {
    stubAllFresh(1)
    latestByTable.set('sab_market_raw_listings', { value: null, error: '57014 statement timeout' })

    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.stale).toEqual(['sab_market_raw_listings'])
    expect(
      body.results.find((r: any) => r.table === 'sab_market_raw_listings').error,
    ).toContain('57014')
  })

  it('still fails non-200 when the alert email throws (the red cron must not depend on Resend)', async () => {
    stubAllFresh(1)
    latestByTable.set('sab_price_display', { value: new Date(NOW - 40 * HOUR).toISOString() })
    ;(sendAdminNoticeEmail as any).mockRejectedValueOnce(new Error('resend down'))

    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.alert_emailed).toBe(false)
    expect(body.alert_email_error).toContain('resend down')
  })

  it('names the failing stage in the alert body so the reader need not dig', () => {
    const body = buildAlertBody(
      [
        {
          table: 'sab_market_evidence_display',
          column: 'refreshed_at',
          latest: '2026-09-10T00:00:00.000Z',
          ageHours: 84,
          thresholdHours: 6,
          stale: true,
        },
      ],
      new Date(NOW).toISOString(),
    )
    expect(body).toContain('sab_refresh_evidence_display')
    expect(body).toContain('84h old')
    expect(body).toContain('threshold 6h')
  })
})
