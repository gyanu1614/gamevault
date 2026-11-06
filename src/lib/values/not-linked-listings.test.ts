import { describe, expect, it } from 'vitest'
import { loadNotLinkedListings, NOT_LINKED_LIMIT } from './not-linked-listings'

function client(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = []
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'limit']) {
    b[m] = (...args: unknown[]) => {
      calls.push([m, ...args])
      return b
    }
  }
  b.then = (ok: (v: unknown) => unknown) => ok(result)
  return { calls, db: { from: (t: string) => (calls.push(['from', t]), b) } }
}

describe('loadNotLinkedListings', () => {
  it('asks once: live item listings of this game with no item, newest first, capped', async () => {
    const { calls, db } = client({ data: [], error: null })
    await loadNotLinkedListings(db, 'murder-mystery-2')
    expect(calls.filter((c) => c[0] === 'from')).toEqual([['from', 'listings']])
    expect(calls).toContainEqual(['eq', 'game.slug', 'murder-mystery-2'])
    expect(calls).toContainEqual(['eq', 'category.type', 'items'])
    expect(calls).toContainEqual(['eq', 'status', 'active'])
    expect(calls).toContainEqual(['is', 'value_item_slug', null])
    expect(calls).toContainEqual(['limit', NOT_LINKED_LIMIT])
  })

  it('reads the seller from public profiles, never the private table', async () => {
    const { calls, db } = client({ data: [], error: null })
    await loadNotLinkedListings(db, 'adopt-me')
    const columns = String(calls.find((c) => c[0] === 'select')?.[1])
    expect(columns).toContain('public_profiles!')
    expect(columns).not.toContain(' profiles!')
  })

  it('maps a row, with its public link', async () => {
    const { db } = client({
      data: [{ id: 'l1', title: 'Frost Wand', slug: 'frost-wand-1', created_at: '2026-11-06T00:00:00Z', category: { slug: 'buy-items', type: 'items' }, seller: { username: 'kay', shop_name: 'Kay Shop' } }],
      error: null,
    })
    expect(await loadNotLinkedListings(db, 'murder-mystery-2')).toEqual([
      { id: 'l1', title: 'Frost Wand', href: '/murder-mystery-2/buy-items/frost-wand-1', seller: 'Kay Shop', listedAt: '2026-11-06T00:00:00Z' },
    ])
  })

  it('a failed read throws, it does not show "nothing to review"', async () => {
    const { db } = client({ data: null, error: { message: 'down' } })
    await expect(loadNotLinkedListings(db, 'adopt-me')).rejects.toThrow('down')
  })
})
