/**
 * ROUTE-018 — /api/cron/expire-sab-listings read resilience.
 *
 * The 2026-09-13 post-crawl run returned
 *   500 {"error":"Failed to read listings","details":"Gateway Timeout"}
 * while the correct-prices step that follows it succeeded. The route scans every
 * active listing (~36,600 rows on prod, +3k/day) in ~37 sequential pages, and a
 * single failing page aborted the entire job — nothing was expired at all.
 *
 * Note the failure class: a GATEWAY timeout, not Postgres 57014. Migration
 * 20260913121000 already gives service_role a 120s statement budget, so the
 * individual queries were inside their limit and it was the FUNCTION running out
 * of wall clock. Both classes are covered below, because both reach this code as
 * an error on a page read.
 *
 * These tests pin three properties:
 *   1. a transient page failure (57014 or Gateway Timeout) is RETRIED, and the
 *      job completes rather than expiring nothing;
 *   2. a non-transient failure (bad column, missing relation) still fails FAST —
 *      retrying cannot help and would only delay the real error;
 *   3. every page is read with a stable ORDER BY, so page boundaries cannot skip
 *      or duplicate rows. A skipped row that carried its group's newest
 *      fetched_at would drag that group's max backwards and expire listings that
 *      are still live.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Page = { rows: any[] } | { error: { message: string; code?: string } }

/** Queued outcomes per range-start offset; each read shifts one off. */
const readPlan = new Map<number, Page[]>()
const readCalls: { from: number; to: number; ordered: string[] }[] = []
const writeCalls: { ids: string[]; endedAt: string }[] = []
let writePlan: Page[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from() {
      const state: any = { ordered: [], update: null }
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: (_col: string, ids: string[]) => {
          state.ids = ids
          return builder
        },
        order: (col: string) => {
          state.ordered.push(col)
          return builder
        },
        update: (patch: any) => {
          state.update = patch
          // The write chain ends on .eq(), so resolve it as a thenable.
          builder.then = (resolve: any) => {
            const outcome = writePlan.shift() ?? { rows: [] }
            writeCalls.push({ ids: state.ids, endedAt: patch.ended_at })
            return resolve(
              'error' in outcome
                ? { data: null, error: outcome.error }
                : { data: null, error: null },
            )
          }
          return builder
        },
        range: async (from: number, to: number) => {
          readCalls.push({ from, to, ordered: [...state.ordered] })
          const queue = readPlan.get(from) ?? []
          const outcome = queue.shift() ?? { rows: [] }
          if ('error' in outcome) return { data: null, error: outcome.error }
          return { data: outcome.rows, error: null }
        },
      }
      return builder
    },
  }),
}))

const ORIGINAL_SECRET = process.env.CRON_SECRET

async function callRoute() {
  const { GET } = await import('@/app/api/cron/expire-sab-listings/route')
  const request = new Request('https://example.test/api/cron/expire-sab-listings', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  return GET(request as any)
}

/** One active listing in a freshly-crawled group, so nothing expires by default. */
function listing(id: string, fetchedAt: string, brainrot = 'b1') {
  return { id, source_id: 's1', brainrot_id: brainrot, fetched_at: fetchedAt }
}

const FRESH = new Date(Date.now() - 60 * 60 * 1000).toISOString()

beforeEach(() => {
  vi.resetModules()
  readPlan.clear()
  readCalls.length = 0
  writeCalls.length = 0
  writePlan = []
  process.env.CRON_SECRET = 'test-secret'
})

describe('ROUTE-018 — transient read failures are retried', () => {
  it('recovers from a Gateway Timeout — the failure actually observed', () => {
    // The exact details string from the 2026-09-13 run.
    readPlan.set(0, [
      { error: { message: 'Gateway Timeout' } },
      { rows: [listing('a', FRESH)] },
    ])

    return callRoute().then(async (response) => {
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.active_listings_scanned).toBe(1)
      // Page 0 was attempted twice: the failure, then the success.
      expect(readCalls.filter((c) => c.from === 0)).toHaveLength(2)
    })
  })

  it('recovers from a Postgres statement timeout (57014)', async () => {
    readPlan.set(0, [
      {
        error: {
          message: 'canceling statement due to statement timeout',
          code: '57014',
        },
      },
      { rows: [listing('a', FRESH)] },
    ])

    const response = await callRoute()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      active_listings_scanned: 1,
    })
    expect(readCalls.filter((c) => c.from === 0)).toHaveLength(2)
  })

  // Real timers: the route spends its actual 1s+2s+3s linear backoff, so this
  // test needs more than vitest's default 5s budget. Faking timers here is not
  // worth it — beforeEach resetModules() re-imports the route, which then closes
  // over whichever timer implementation is installed, and the fakes leak into
  // the following test.
  it('gives up after 4 attempts and reports the read failure', async () => {
    const timeout = { error: { message: 'Gateway Timeout' } }
    readPlan.set(0, [timeout, timeout, timeout, timeout])

    const response = await callRoute()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to read listings',
      details: 'Gateway Timeout',
    })
    // Exactly PAGE_MAX_ATTEMPTS, not an unbounded loop.
    expect(readCalls.filter((c) => c.from === 0)).toHaveLength(4)
  }, 15_000)

  it('fails FAST on a non-transient error — a retry could not help', async () => {
    readPlan.set(0, [
      {
        error: {
          message: 'column sab_market_raw_listings.nope does not exist',
          code: '42703',
        },
      },
    ])

    const response = await callRoute()

    expect(response.status).toBe(500)
    // One attempt only: no backoff spent on an error that can never succeed.
    expect(readCalls.filter((c) => c.from === 0)).toHaveLength(1)
  })
})

describe('ROUTE-018 — pagination is stably ordered', () => {
  it('orders every page by the primary key', async () => {
    readPlan.set(0, [{ rows: [listing('a', FRESH)] }])

    await callRoute()

    expect(readCalls.length).toBeGreaterThan(0)
    // Without this, .range() page boundaries silently skip and duplicate rows —
    // the bug that made the SAB correction non-deterministic. A skipped row here
    // can drag a group's newest-crawl max backwards and expire live listings.
    for (const call of readCalls) expect(call.ordered).toEqual(['id'])
  })

  it('pages until a short page, requesting contiguous non-overlapping ranges', async () => {
    const full = Array.from({ length: 1000 }, (_, i) =>
      listing(`id-${i}`, FRESH),
    )
    readPlan.set(0, [{ rows: full }])
    readPlan.set(1000, [{ rows: [listing('id-1000', FRESH)] }])

    const response = await callRoute()

    await expect(response.json()).resolves.toMatchObject({
      active_listings_scanned: 1001,
    })
    expect(readCalls.map((c) => [c.from, c.to])).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })
})

describe('ROUTE-018 — the expiry decision still holds', () => {
  it('retries a transient write failure instead of abandoning the job', async () => {
    // Two listings in one group: 'old' predates the group's newest crawl by well
    // over the grace window, so it is expired.
    const newest = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const old = new Date(Date.now() - 60 * 60 * 1000 - 10 * 60 * 60 * 1000).toISOString()
    readPlan.set(0, [{ rows: [listing('new', newest), listing('old', old)] }])
    writePlan = [{ error: { message: 'Gateway Timeout' } }, { rows: [] }]

    const response = await callRoute()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ expired: 1 })
    // Attempted twice, same batch — safe because the write re-asserts
    // listing_status='active', so a replay only touches what is still active.
    expect(writeCalls).toHaveLength(2)
    expect(writeCalls[0].ids).toEqual(['old'])
    expect(writeCalls[1].ids).toEqual(['old'])
  })

  it('still refuses to conclude anything from a stale group', async () => {
    // Group last crawled 100h ago — past RECENT_CRAWL_HOURS (36).
    const stale = new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString()
    const older = new Date(Date.now() - 200 * 60 * 60 * 1000).toISOString()
    readPlan.set(0, [{ rows: [listing('a', stale), listing('b', older)] }])

    const response = await callRoute()

    // The absence guard is the whole point of the job: if we stopped looking, we
    // must not declare the catalog sold. Retrying must not weaken it.
    await expect(response.json()).resolves.toMatchObject({
      expired: 0,
      groups_skipped_not_recently_crawled: 1,
    })
    expect(writeCalls).toHaveLength(0)
  })

  it('rejects an unauthorized request before reading anything', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const { GET } = await import('@/app/api/cron/expire-sab-listings/route')
    const response = await GET(
      new Request('https://example.test/x', {
        headers: { authorization: 'Bearer wrong' },
      }) as any,
    )

    expect(response.status).toBe(401)
    expect(readCalls).toHaveLength(0)
  })
})

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET
})
