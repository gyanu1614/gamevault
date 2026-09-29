import { describe, it, expect } from 'vitest'
import { fetchAllRows, chunk } from './fetch-all'

function fakeTable(n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }))
  const calls: Array<[number, number]> = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    return { data: rows.slice(from, to + 1), error: null }
  }
  return { page, calls }
}

describe('fetchAllRows', () => {
  it('walks past the 1000-row cap', async () => {
    const t = fakeTable(2345)
    const { data, error } = await fetchAllRows(t.page)
    expect(error).toBeNull()
    expect(data).toHaveLength(2345)
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
  it('stops after one call when the first page is short', async () => {
    const t = fakeTable(3)
    expect((await fetchAllRows(t.page)).data).toHaveLength(3)
    expect(t.calls).toHaveLength(1)
  })
  it('an exact multiple ends on the empty page', async () => {
    const t = fakeTable(2000)
    expect((await fetchAllRows(t.page)).data).toHaveLength(2000)
    expect(t.calls).toHaveLength(3)
  })
  it('returns the error and no rows when a page fails', async () => {
    let n = 0
    const res = await fetchAllRows(async () => (n++ === 0
      ? { data: Array.from({ length: 1000 }, (_, i) => i), error: null }
      : { data: null, error: { message: 'boom' } }))
    expect(res).toEqual({ data: null, error: { message: 'boom' } })
  })
})

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
  })
})
