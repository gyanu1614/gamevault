import { describe, it, expect } from 'vitest'
import { loadPublishedSnapshot, PublishedSnapshotUnavailableError } from './publish'

/** Minimal PostgREST stand-in: rows filtered by eq + keyset or(), ordered, limited. */
function fakeClient(rows: Array<{ game_slug: string; item_slug: string; variant: string; prices: unknown }>, error?: { code?: string; message: string }) {
  const requests: string[] = []
  return {
    requests,
    from(table: string) {
      const q = { eqs: [] as [string, unknown][], ors: [] as string[], lim: Infinity, usedRange: false }
      const api: any = {
        select: () => api,
        eq: (c: string, v: unknown) => (q.eqs.push([c, v]), api),
        or: (e: string) => (q.ors.push(e), api),
        order: () => api,
        limit: (n: number) => ((q.lim = n), api),
        range: () => {
          throw new Error('OFFSET paging used')
        },
        then: (resolve: any) => {
          requests.push(q.usedRange ? `${table}:range` : `${table}:keyset`)
          if (error) return resolve({ data: null, error })
          let out = rows.filter((r: any) => q.eqs.every(([c, v]) => r[c] === v))
          for (const e of q.ors) {
            const m = /^item_slug\.gt\.([^,]+),and\(item_slug\.eq\.\1,variant\.gt\.([^)]+)\)$/.exec(e)!
            out = out.filter((r) => r.item_slug > m[1] || (r.item_slug === m[1] && r.variant > m[2]))
          }
          out = [...out].sort((a, b) => a.item_slug.localeCompare(b.item_slug) || a.variant.localeCompare(b.variant))
          resolve({ data: out.slice(0, q.lim), error: null })
        },
      }
      return api
    },
  }
}

describe('loadPublishedSnapshot', () => {
  it('reads every published row of the game by keyset', async () => {
    const rows: Array<{ game_slug: string; item_slug: string; variant: string; prices: unknown }> = Array.from({ length: 2500 }, (_, i) => ({ game_slug: 'mm2', item_slug: `item-${String(i).padStart(4, '0')}`, variant: 'default', prices: { market: i } }))
    rows.push({ game_slug: 'other', item_slug: 'x', variant: 'default', prices: {} })
    const client = fakeClient(rows)
    const out = await loadPublishedSnapshot(client as never, 'mm2')
    expect(out).toHaveLength(2500)
    expect(client.requests.every((r) => r.endsWith(':keyset'))).toBe(true)
  })

  it('turns a missing table into PublishedSnapshotUnavailableError', async () => {
    const client = fakeClient([], { code: 'PGRST205', message: 'Could not find the table public.values_published_prices in the schema cache' })
    await expect(loadPublishedSnapshot(client as never, 'mm2')).rejects.toBeInstanceOf(PublishedSnapshotUnavailableError)
  })
})
