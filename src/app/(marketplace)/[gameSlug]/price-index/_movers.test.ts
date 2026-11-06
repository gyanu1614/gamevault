import { describe, expect, it } from 'vitest'
import { moversBetween } from './_movers'

const span = { fromDate: '2026-10-30', toDate: '2026-11-06' }
const name = (id: string) => ({ id, name: `Item ${id}`, slug: `item-${id}` })
const day = (id: string, history_date: string, median_usd: number | string | null) => ({ brainrot_id: id, history_date, median_usd })
const both = (id: string, from: number | string | null, to: number | string | null) => [day(id, span.fromDate, from), day(id, span.toDate, to)]

describe('moversBetween', () => {
  it('splits gains from losses, biggest first, with the name and link', () => {
    const rows = [...both('a', 10, 15), ...both('b', 10, 30), ...both('c', 10, 5), ...both('d', 10, 1)]
    const { gainers, losers } = moversBetween(rows, ['a', 'b', 'c', 'd'].map(name), span)
    expect(gainers.map((m) => m.slug)).toEqual(['item-b', 'item-a'])
    expect(losers.map((m) => m.slug)).toEqual(['item-d', 'item-c'])
    expect(gainers[0]).toEqual({ slug: 'item-b', name: 'Item b', from: 10, to: 30, pct: 200 })
  })

  it('shows at most eight each way', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `g${i}`)
    const rows = ids.flatMap((id, i) => both(id, 10, 20 + i))
    const { gainers } = moversBetween(rows, ids.map(name), span)
    expect(gainers).toHaveLength(8)
    expect(gainers[0].slug).toBe('item-g19')
  })

  it('leaves out moves under 1%', () => {
    const { gainers, losers } = moversBetween([...both('a', 100, 100.5), ...both('b', 100, 99.5)], ['a', 'b'].map(name), span)
    expect(gainers).toEqual([])
    expect(losers).toEqual([])
  })

  it('needs a price on both days', () => {
    const rows = [day('a', span.fromDate, 10), day('b', span.toDate, 10), ...both('c', null, 10), ...both('d', 10, null), ...both('e', 0, 10)]
    const { gainers, losers } = moversBetween(rows, ['a', 'b', 'c', 'd', 'e'].map(name), span)
    expect(gainers).toEqual([])
    expect(losers).toEqual([])
  })

  it('ignores any other day', () => {
    const rows = [...both('a', 10, 20), day('a', '2026-11-01', 1000)]
    expect(moversBetween(rows, [name('a')], span).gainers[0]).toMatchObject({ from: 10, to: 20, pct: 100 })
  })

  it('reads prices stored as text', () => {
    expect(moversBetween(both('a', '10.5', '21'), [name('a')], span).gainers[0]).toMatchObject({ from: 10.5, to: 21, pct: 100 })
  })

  it('leaves out an item with no catalogue row, and still fills the list', () => {
    const rows = [...both('gone', 10, 1000), ...both('a', 10, 20)]
    expect(moversBetween(rows, [name('a')], span).gainers.map((m) => m.slug)).toEqual(['item-a'])
  })
})
