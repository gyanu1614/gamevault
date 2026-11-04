import { describe, it, expect } from 'vitest'
import { catalogueEntryFromRow } from '../../../scripts/lib/values-import.mjs'
import { buildMarketIndex, resolveMarketKey } from '../../lib/values/catalogue/resolve'
import { marketKey } from '../../lib/values/normalisers/eldorado-structured'

// The price job's catalogue comes from values_items rows; the resolver can only
// use what this mapping carries. 2026-11-02: Eldorado's "Stickers (Halloween
// 2021)" needs the row's origin to find "Stickers (Knife)".
describe('values_items row → catalogue entry', () => {
  const row = { slug: 'stickers-knife', name: 'Stickers (Knife)', wiki_title: 'Stickers (Knife)', item_type: 'knife', base_item_id: null, release_year: 2021, origin: '2021 Halloween Box' }

  it('carries the origin, so an event-dated market name resolves', () => {
    const entry = catalogueEntryFromRow(row)
    expect(entry).toMatchObject({ slug: 'stickers-knife', title: 'Stickers (Knife)', displayTitle: null, itemType: 'knife', isChroma: false, releaseYear: 2021, origin: '2021 Halloween Box' })
    const index = buildMarketIndex([entry])
    expect(resolveMarketKey(marketKey('knife', 'default', 'Stickers (Halloween 2021)'), index).slug).toBe('stickers-knife')
  })

  it('a row with a base, or titled Chroma, is a chroma entry', () => {
    expect(catalogueEntryFromRow({ ...row, slug: 'chroma-x', name: 'Chroma X', wiki_title: null, base_item_id: 'b' })).toMatchObject({ title: 'Chroma X', isChroma: true })
  })
})
