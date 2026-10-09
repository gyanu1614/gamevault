import { describe, it, expect } from 'vitest'
import { splitActiveOrders } from './active-orders-split'

const ME = 'me'
const row = (id: string, side: 'buy' | 'sell', status = 'paid') => ({
  id,
  status,
  buyer_id: side === 'buy' ? ME : 'other',
  seller_id: side === 'sell' ? ME : 'other',
})

describe('splitActiveOrders', () => {
  it('splits one newest-first list into buying and selling, keeping order', () => {
    const out = splitActiveOrders([row('a', 'sell'), row('b', 'buy'), row('c', 'sell')], ME)
    expect(out.buying.map((o) => o.id)).toEqual(['b'])
    expect(out.selling.map((o) => o.id)).toEqual(['a', 'c'])
  })

  it('caps each side at five', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`s${i}`, 'sell')).concat(
      Array.from({ length: 7 }, (_, i) => row(`b${i}`, 'buy')),
    )
    const out = splitActiveOrders(rows, ME)
    expect(out.selling).toHaveLength(5)
    expect(out.buying).toHaveLength(5)
  })

  it('keeps a buyer\'s unpaid pending order but never a seller\'s', () => {
    const out = splitActiveOrders([row('p1', 'buy', 'pending'), row('p2', 'sell', 'pending')], ME)
    expect(out.buying.map((o) => o.id)).toEqual(['p1'])
    expect(out.selling).toEqual([])
  })
})
