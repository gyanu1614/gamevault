/**
 * Notify Me's one rule: an item counts as listed only when its page would show
 * an offer. A live listing from a paused store or a test account does not count
 * (owner, 2026-11-04: emailed "Frost Fury Is Listed" with none on the site).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  rows: [] as Array<{ seller_id: string; value_variant: string | null }>,
  paused: [] as string[],
  test: [] as string[],
  pair: { gameId: 'g-1' } as { gameId: string } | null,
  listingsFail: false,
  presenceFail: false,
  fetchArgs: [] as unknown[][],
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/value-listings/stock-server', () => ({
  getItemsPair: vi.fn(async () => h.pair),
  getValueCatalog: vi.fn(async () => ({ catalog: {} })),
  fetchValueListings: vi.fn(async (...args: unknown[]) => {
    h.fetchArgs.push(args)
    if (h.listingsFail) throw new Error('read failed')
    return h.rows
  }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      const seen: { ids: string[] } = { ids: [] }
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        in: (_c: string, ids: string[]) => {
          seen.ids = ids
          return b
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (table === 'seller_presence') {
            if (h.presenceFail) return resolve({ data: null, error: { message: 'presence down' } })
            return resolve({ data: h.paused.filter((s) => seen.ids.includes(s)).map((seller_id) => ({ seller_id })), error: null })
          }
          return resolve({ data: h.test.filter((s) => seen.ids.includes(s)).map((id) => ({ id })), error: null })
        },
      }
      return b
    },
  }),
}))

import { itemHasVisibleOffer } from './visible-offer'

beforeEach(() => {
  h.rows = []
  h.paused = []
  h.test = []
  h.pair = { gameId: 'g-1' }
  h.listingsFail = false
  h.presenceFail = false
  h.fetchArgs = []
})

describe('itemHasVisibleOffer', () => {
  it('no listing: not listed', async () => {
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', null)).toBe(false)
  })

  it('a listing from an ordinary seller: listed', async () => {
    h.rows = [{ seller_id: 's-1', value_variant: 'fly-ride' }]
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', null)).toBe(true)
  })

  it("the Frost Fury case: the only listing is from a paused store, so it isn't listed", async () => {
    h.rows = [{ seller_id: 's-1', value_variant: 'fly-ride' }]
    h.paused = ['s-1']
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', null)).toBe(false)
  })

  it("a test account's listing isn't listed either", async () => {
    h.rows = [{ seller_id: 's-1', value_variant: null }]
    h.test = ['s-1']
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', null)).toBe(false)
  })

  it('one ordinary seller among paused ones is enough', async () => {
    h.rows = [{ seller_id: 's-1', value_variant: null }, { seller_id: 's-2', value_variant: null }]
    h.paused = ['s-1']
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', null)).toBe(true)
  })

  it('a trait alert counts only that trait, and only a visible seller of it', async () => {
    h.rows = [{ seller_id: 's-1', value_variant: 'fly-ride' }, { seller_id: 's-2', value_variant: 'neon-fly-ride' }]
    h.paused = ['s-2']
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', 'fly-ride')).toBe(true)
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', 'neon-fly-ride')).toBe(false)
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', 'mega-fly-ride')).toBe(false)
  })

  it('reads the item with no cached seller list, so a store un-paused this moment counts', async () => {
    await itemHasVisibleOffer('adopt-me', 'frost-fury', null)
    expect(h.fetchArgs[0][1]).toBe('frost-fury')
    expect(h.fetchArgs[0][2]).toEqual([])
  })

  it('a game with no items page has nothing listed', async () => {
    h.pair = null
    h.rows = [{ seller_id: 's-1', value_variant: null }]
    expect(await itemHasVisibleOffer('adopt-me', 'frost-fury', null)).toBe(false)
  })

  it('a failed read throws: "could not check" must never read as "not listed"', async () => {
    h.listingsFail = true
    await expect(itemHasVisibleOffer('adopt-me', 'frost-fury', null)).rejects.toThrow()
    h.listingsFail = false
    h.rows = [{ seller_id: 's-1', value_variant: null }]
    h.presenceFail = true
    await expect(itemHasVisibleOffer('adopt-me', 'frost-fury', null)).rejects.toThrow(/presence down/)
  })
})
