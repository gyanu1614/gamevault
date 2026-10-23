import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const getValueItems = vi.fn()
vi.mock('@/lib/values/data', () => ({
  getValueItems: (...a: unknown[]) => getValueItems(...a),
  getValueTrends: async () => ({ pctByItem: {} }),
}))

import { getValueListRows } from './valueListRows'
import { pack, unpack } from '@/lib/serialize/columnar'

const DAY = 86_400_000
const item = (slug: string, addedAt: string | null) => ({
  releaseYear: new Date().getUTCFullYear(),
  id: slug,
  slug,
  name: slug,
  rarity: 'Godly',
  itemType: 'knife',
  imageUrl: null,
  baseItemId: null,
  addedAt,
  price: null,
})

describe('generic value list rows: New flag', () => {
  beforeEach(() => getValueItems.mockReset())

  it('flags an item added in the last 14 days and leaves the key off every other row', async () => {
    getValueItems.mockResolvedValue([
      item('emberbow', new Date(Date.now() - 2 * DAY).toISOString()),
      item('fang', new Date(Date.now() - 60 * DAY).toISOString()),
      item('no-date', null),
    ])
    const { rows } = await getValueListRows('murder-mystery-2')
    expect(rows.map((r) => r.isNew)).toEqual([true, undefined, undefined])
    expect('isNew' in rows[1]).toBe(false)
    // rows.json round trip: the flag survives; JSON turns the gaps into nulls, still not new.
    const back = unpack<typeof rows>(JSON.parse(JSON.stringify(pack(rows))))
    expect(back.map((r) => Boolean(r.isNew))).toEqual([true, false, false])
  })
})
