/**
 * SAB price history is read WHOLE (the chart has an "All" range), by keyset.
 *
 * It was one request with no limit, oldest first: PostgREST returns at most
 * 1,000 rows, so once a brainrot had ~71 days × 14 mutations of history the
 * NEWEST days fell off and the chart froze in the past.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const ROWS = Array.from({ length: 2000 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 0, 1) + Math.floor(i / 14) * 86_400_000).toISOString().slice(0, 10)
  return { history_date: day, mutation_id: `m${String(i % 14).padStart(2, '0')}`, median_usd: i, sab_mutations: { slug: `mut-${i % 14}` } }
})

function fakeClient() {
  return {
    from() {
      const q = { ors: [] as string[], lim: 1000 }
      const api: any = {
        select: () => api,
        eq: () => api,
        order: () => api,
        or: (e: string) => (q.ors.push(e), api),
        gt: () => api,
        limit: (n: number) => ((q.lim = n), api),
        range: () => {
          throw new Error('OFFSET paging used')
        },
        then: (resolve: (v: unknown) => void) => {
          let out = ROWS
          for (const e of q.ors) {
            const m = /^history_date\.gt\.([^,]+),and\(history_date\.eq\.\1,mutation_id\.gt\.([^)]+)\)$/.exec(e)!
            out = out.filter((r) => r.history_date > m[1] || (r.history_date === m[1] && r.mutation_id > m[2]))
          }
          // PostgREST's cap: never more than 1,000 rows per response.
          resolve({ data: out.slice(0, Math.min(q.lim, 1000)), error: null })
        },
      }
      return api
    },
  }
}
vi.mock('@/lib/values/read-client', () => ({ createValueItemReadClient: () => fakeClient() }))

import { getPriceHistory } from './_sabItemData'

describe('getPriceHistory', () => {
  it('returns every day, the newest included, past the 1,000-row cap', async () => {
    const bySlug = await getPriceHistory('some-brainrot', 'b1')
    const total = Object.values(bySlug).reduce((n, points) => n + points.length, 0)
    expect(total).toBe(2000)
    const last = ROWS.at(-1)!
    expect(bySlug[last.sab_mutations.slug].at(-1)?.date).toBe(last.history_date)
  })
})
