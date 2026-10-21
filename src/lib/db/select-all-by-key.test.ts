import { describe, it, expect } from 'vitest'
import { selectAllByKey, isRetryableReadError } from './select-all-by-key'

type Row = Record<string, string | number | boolean>
type Err = { message?: string; code?: string }

/**
 * A tiny in-memory PostgREST: select / eq / gt / or (the keyset shape the
 * helper emits) / order / limit, awaited as `{ data, error }`. It records each
 * request so tests can assert that NO request uses OFFSET (`range`).
 */
function fakeClient(rows: Row[], opts: { failures?: Err[] } = {}) {
  const failures = [...(opts.failures ?? [])]
  const requests: string[] = []
  const client = {
    from(table: string) {
      const q = { table, cols: '', eqs: [] as [string, unknown][], gts: [] as [string, string][], ors: [] as string[], orders: [] as string[], lim: Infinity }
      const api = {
        select(cols: string) { q.cols = cols; return api },
        eq(c: string, v: unknown) { q.eqs.push([c, v]); return api },
        gt(c: string, v: string) { q.gts.push([c, v]); return api },
        or(expr: string) { q.ors.push(expr); return api },
        order(c: string) { q.orders.push(c); return api },
        limit(n: number) { q.lim = n; return api },
        range() { throw new Error('OFFSET paging used') },
        then(resolve: (v: { data: Row[] | null; error: Err | null }) => void) {
          requests.push(JSON.stringify({ cols: q.cols, gts: q.gts, ors: q.ors, orders: q.orders, lim: q.lim }))
          const failure = failures.shift()
          if (failure) return resolve({ data: null, error: failure })
          let out = rows.filter((r) => q.eqs.every(([c, v]) => r[c] === v))
          for (const [c, v] of q.gts) out = out.filter((r) => String(r[c]) > v)
          for (const expr of q.ors) {
            // a.gt.X,and(a.eq.X,b.gt.Y)
            const m = /^(\w+)\.gt\.([^,]+),and\(\1\.eq\.\2,(\w+)\.gt\.([^)]+)\)$/.exec(expr)
            if (!m) throw new Error(`unexpected or(): ${expr}`)
            const [, a, va, b, vb] = m
            out = out.filter((r) => String(r[a]) > va || (String(r[a]) === va && String(r[b]) > vb))
          }
          out = [...out].sort((x, y) => {
            for (const c of q.orders) {
              if (String(x[c]) < String(y[c])) return -1
              if (String(x[c]) > String(y[c])) return 1
            }
            return 0
          })
          resolve({ data: out.slice(0, q.lim), error: null })
        },
      }
      return api
    },
  }
  return { client, requests }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${String(i).padStart(3, '0')}`, v: i, active: i % 2 === 0 }))

describe('selectAllByKey (keyset paging, no OFFSET)', () => {
  it('reads every row exactly once across page seams', async () => {
    const { client } = fakeClient(ids(7))
    const out = await selectAllByKey<Row>(client, { table: 't', columns: 'id,v', key: 'id', pageSize: 3 })
    expect(out.map((r) => r.v)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('asks for the next page after the last key it saw, never by offset', async () => {
    const { client, requests } = fakeClient(ids(5))
    await selectAllByKey<Row>(client, { table: 't', columns: 'id,v', key: 'id', pageSize: 2 })
    const gts = requests.map((r) => JSON.parse(r).gts)
    expect(gts).toEqual([[], [['id', 'id-001']], [['id', 'id-003']]])
  })

  it('stops after a short page without an extra empty request', async () => {
    const { client, requests } = fakeClient(ids(5))
    await selectAllByKey<Row>(client, { table: 't', columns: 'id,v', key: 'id', pageSize: 2 })
    expect(requests).toHaveLength(3)
  })

  it('pushes the filter into the query', async () => {
    const { client } = fakeClient(ids(6))
    const out = await selectAllByKey<Row>(client, {
      table: 't',
      columns: 'id,v',
      key: 'id',
      pageSize: 2,
      filter: (q) => q.eq('active', true),
    })
    expect(out.map((r) => r.v)).toEqual([0, 2, 4])
  })

  it('selects the key even when the caller did not ask for it', async () => {
    const { client, requests } = fakeClient(ids(2))
    await selectAllByKey<Row>(client, { table: 't', columns: 'v', key: 'id' })
    expect(JSON.parse(requests[0]).cols).toBe('v,id')
  })

  it('selects the key under its own name when the caller only aliased it', async () => {
    // `slug:id` returns the column as `slug`; the cursor needs `id` itself.
    const { client, requests } = fakeClient(ids(2))
    await selectAllByKey<Row>(client, { table: 't', columns: 'slug:id,v', key: 'id' })
    expect(JSON.parse(requests[0]).cols).toBe('slug:id,v,id')
  })

  it('pages a composite key (a, b) without skipping ties on a', async () => {
    const rows = [
      { a: 'x', b: '1' }, { a: 'x', b: '2' }, { a: 'x', b: '3' },
      { a: 'y', b: '1' }, { a: 'y', b: '2' },
    ]
    const { client } = fakeClient(rows)
    const out = await selectAllByKey<Row>(client, { table: 't', columns: 'a,b', key: ['a', 'b'], pageSize: 2 })
    expect(out.map((r) => `${r.a}${r.b}`)).toEqual(['x1', 'x2', 'x3', 'y1', 'y2'])
  })

  it('retries a statement timeout, then succeeds', async () => {
    const { client } = fakeClient(ids(2), { failures: [{ code: '57014', message: 'canceling statement due to statement timeout' }] })
    const out = await selectAllByKey<Row>(client, { table: 't', columns: 'id', key: 'id', retryDelayMs: () => 0 })
    expect(out).toHaveLength(2)
  })

  it('fails fast on a schema error, naming the table', async () => {
    const { client } = fakeClient(ids(2), { failures: [{ code: '42703', message: 'column t.nope does not exist' }] })
    await expect(selectAllByKey<Row>(client, { table: 't', columns: 'id', key: 'id', retryDelayMs: () => 0 })).rejects.toThrow(
      't: column t.nope does not exist',
    )
  })
})

describe('selectAllByKey errors', () => {
  it('keeps the original PostgREST error as `cause` (callers branch on its code)', async () => {
    const original = { code: 'PGRST205', message: 'Could not find the table public.t in the schema cache' }
    const { client } = fakeClient(ids(1), { failures: [original] })
    const err = await selectAllByKey<Row>(client, { table: 't', columns: 'id', key: 'id', retryDelayMs: () => 0 }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error & { cause?: unknown }).cause).toEqual(original)
  })
})

describe('isRetryableReadError', () => {
  it('retries statement timeouts and transient network errors only', () => {
    expect(isRetryableReadError({ code: '57014' })).toBe(true)
    expect(isRetryableReadError({ message: 'fetch failed' })).toBe(true)
    expect(isRetryableReadError({ code: '42501', message: 'permission denied for table t' })).toBe(false)
    expect(isRetryableReadError({})).toBe(false)
  })
})
