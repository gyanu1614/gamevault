import { describe, it, expect, vi } from 'vitest'

import { fetchAllRows } from '@/lib/seo/paged-read'

/**
 * PostgREST silently truncates a read at 1,000 rows (supabase max_rows), so a
 * listings or catalogue table past that size would quietly drop its tail from
 * the sitemap. fetchAllRows pages through with .range() until a short page.
 */
const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }))

function pager(rows: { id: number }[], opts: { failAt?: number } = {}) {
  const calls: [number, number][] = []
  const build = vi.fn(async (from: number, to: number) => {
    calls.push([from, to])
    if (opts.failAt !== undefined && from >= opts.failAt) return { data: null, error: { message: 'boom' } }
    return { data: rows.slice(from, to + 1), error: null }
  })
  return { build, calls }
}

describe('fetchAllRows', () => {
  it('reads past the 1,000-row cap', async () => {
    const { build, calls } = pager(table(2500))
    const all = await fetchAllRows(build)
    expect(all).toHaveLength(2500)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(new Set(all.map((r) => r.id)).size).toBe(2500)
  })

  it('stops after a short page without an extra empty request', async () => {
    const { build } = pager(table(40))
    expect(await fetchAllRows(build)).toHaveLength(40)
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('asks for one more page when a page is exactly full, then stops on the empty one', async () => {
    const { build } = pager(table(1000))
    expect(await fetchAllRows(build)).toHaveLength(1000)
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('throws on a failed page rather than returning a silently truncated list', async () => {
    const { build } = pager(table(2500), { failAt: 1000 })
    await expect(fetchAllRows(build)).rejects.toThrow(/boom/)
  })

  it('gives up on a runaway table instead of looping forever', async () => {
    const build = vi.fn(async () => ({ data: table(1000), error: null }))
    await expect(fetchAllRows(build, { maxPages: 5 })).rejects.toThrow(/more than 5 pages/)
  })
})
