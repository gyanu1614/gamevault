import { describe, expect, it, vi } from 'vitest'
import { fillMissingListingPicture } from './item-picture'

type Row = { images: string[] | null; value_item_slug: string | null; game_id: string; game: { slug: string; image_url: string | null } | null }

/** Just enough of the query builder: what each table answers, and what got written. */
function fakeDb(row: Row | null, catalog: Record<string, { image_url: string | null } | null> = {}) {
  const writes: unknown[] = []
  const from = vi.fn((table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: table === 'listings' ? row : catalog[table] ?? null, error: null }),
      update: (patch: unknown) => {
        writes.push(patch)
        return { eq: async () => ({ error: null }) }
      },
    }
    return chain
  })
  return { db: { from }, writes, from }
}

const base: Row = { images: [], value_item_slug: 'frost-dragon', game_id: 'g1', game: { slug: 'adopt-me', image_url: 'https://x/game.webp' } }

describe('fillMissingListingPicture', () => {
  it("gives an Adopt Me offer with no photos its pet's picture", async () => {
    const { db, writes, from } = fakeDb(base, { adopt_me_pets: { image_url: 'https://x/frost.webp' } })
    await fillMissingListingPicture(db, 'l1')
    expect(writes).toEqual([{ images: ['https://x/frost.webp'] }])
    expect(from).toHaveBeenCalledWith('adopt_me_pets')
  })

  it("reads another game's item from values_items", async () => {
    const { db, writes, from } = fakeDb({ ...base, value_item_slug: 'sunrise', game: { slug: 'murder-mystery-2', image_url: null } }, { values_items: { image_url: 'https://x/sunrise.webp' } })
    await fillMissingListingPicture(db, 'l1')
    expect(writes).toEqual([{ images: ['https://x/sunrise.webp'] }])
    expect(from).toHaveBeenCalledWith('values_items')
  })

  it('leaves a listing with its own photos alone', async () => {
    const { db, writes } = fakeDb({ ...base, images: ['https://x/mine.webp'] }, { adopt_me_pets: { image_url: 'https://x/frost.webp' } })
    await fillMissingListingPicture(db, 'l1')
    expect(writes).toEqual([])
  })

  it("falls back to the game's picture when the listing didn't link to an item", async () => {
    const { db, writes } = fakeDb({ ...base, value_item_slug: null })
    await fillMissingListingPicture(db, 'l1')
    expect(writes).toEqual([{ images: ['https://x/game.webp'] }])
  })

  it("falls back to the game's picture when the item has none", async () => {
    const { db, writes } = fakeDb(base, { adopt_me_pets: { image_url: null } })
    await fillMissingListingPicture(db, 'l1')
    expect(writes).toEqual([{ images: ['https://x/game.webp'] }])
  })

  it('writes nothing when there is no picture at all', async () => {
    const { db, writes } = fakeDb({ ...base, value_item_slug: null, game: { slug: 'adopt-me', image_url: null } })
    await fillMissingListingPicture(db, 'l1')
    expect(writes).toEqual([])
  })

  it('never throws: a publish must not fail over a picture', async () => {
    const db = { from: () => { throw new Error('down') } }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fillMissingListingPicture(db, 'l1')).resolves.toBeUndefined()
    log.mockRestore()
  })
})
