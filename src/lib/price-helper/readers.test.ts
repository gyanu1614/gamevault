import { describe, expect, it } from 'vitest'
import { readCurrencyOffers, readItemPrice } from './readers'

/** Chainable PostgREST stand-in: records every call, answers per table. */
function fakeClient(answers: Record<string, { data: unknown; error?: unknown }>) {
  const calls: Array<{ table: string; ops: Array<[string, unknown[]]> }> = []
  const client = {
    from(table: string) {
      const rec = { table, ops: [] as Array<[string, unknown[]]> }
      calls.push(rec)
      const answer = answers[table] ?? { data: null }
      const builder: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) => resolve({ data: answer.data, error: answer.error ?? null })
            }
            return (...args: unknown[]) => {
              rec.ops.push([prop, args])
              return builder
            }
          },
        },
      )
      return builder
    },
  }
  return { client, calls }
}

const op = (calls: ReturnType<typeof fakeClient>['calls'], table: string, name: string) =>
  calls.filter((c) => c.table === table).flatMap((c) => c.ops.filter(([n]) => n === name).map(([, a]) => a))

describe('readItemPrice', () => {
  it('SAB: reads the item × mutation row from sab_price_display (the value page headline)', async () => {
    const { client, calls } = fakeClient({
      sab_price_display: {
        // is_public_estimate marks the LIVE market-estimate pipeline (real
        // listings), not a derived guess: it must not hide the price.
        data: { market_value_usd: '18.99', external_sample_size: 12, price_updated_at: '2026-10-07T00:00:00Z', is_public_estimate: true },
      },
    })
    const row = await readItemPrice(client, { gameSlug: 'steal-a-brainrot', gameId: 'g1', itemSlug: 'dragon-cannelloni', variant: 'gold' })
    expect(row).toEqual({ usd: 18.99, offers: 12, updatedAt: '2026-10-07T00:00:00Z' })
    expect(op(calls, 'sab_price_display', 'eq')).toEqual([
      ['brainrot_slug', 'dragon-cannelloni'],
      ['mutation_slug', 'gold'],
    ])
  })

  it('SAB: a null variant reads the default row', async () => {
    const { client, calls } = fakeClient({ sab_price_display: { data: null } })
    expect(await readItemPrice(client, { gameSlug: 'steal-a-brainrot', gameId: 'g1', itemSlug: 'x', variant: null })).toBeNull()
    expect(op(calls, 'sab_price_display', 'eq')).toContainEqual(['mutation_slug', 'default'])
  })

  it('Adopt Me: reads the pet, then its variant row by trait code', async () => {
    const { client, calls } = fakeClient({
      adopt_me_pets: { data: { id: 'pet-1' } },
      adopt_me_pet_values: { data: { average_usd: '42.5', reputable_count: 9, last_priced_at: '2026-10-06T00:00:00Z' } },
    })
    const row = await readItemPrice(client, { gameSlug: 'adopt-me', gameId: 'g2', itemSlug: 'bat-dragon', variant: 'neon-fly-ride' })
    expect(row).toEqual({ usd: 42.5, offers: 9, updatedAt: '2026-10-06T00:00:00Z' })
    expect(op(calls, 'adopt_me_pet_values', 'eq')).toEqual([
      ['pet_id', 'pet-1'],
      ['variant', 'NFR'],
    ])
  })

  it('Adopt Me: an unknown variant key reads nothing', async () => {
    const { client, calls } = fakeClient({})
    expect(await readItemPrice(client, { gameSlug: 'adopt-me', gameId: 'g2', itemSlug: 'bat-dragon', variant: 'shiny' })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('values pipeline (MM2 / Steal an Egg): reads the item, then values_prices', async () => {
    const { client, calls } = fakeClient({
      values_items: { data: { id: 'item-7' } },
      values_prices: { data: { average_usd: '6.2', sample_size: 5, updated_at: '2026-10-08T00:00:00Z' } },
    })
    const row = await readItemPrice(client, { gameSlug: 'murder-mystery-2', gameId: 'g3', itemSlug: 'harvester', variant: null })
    expect(row).toEqual({ usd: 6.2, offers: 5, updatedAt: '2026-10-08T00:00:00Z' })
    expect(op(calls, 'values_items', 'eq')).toEqual([
      ['game_id', 'g3'],
      ['slug', 'harvester'],
      ['is_enabled', true],
    ])
    expect(op(calls, 'values_prices', 'eq')).toEqual([['item_id', 'item-7']])
  })

  it('throws on a read error (the resolver turns it into "hidden")', async () => {
    const { client } = fakeClient({ sab_price_display: { data: null, error: { message: 'boom' } } })
    await expect(
      readItemPrice(client, { gameSlug: 'steal-a-brainrot', gameId: 'g1', itemSlug: 'x', variant: null }),
    ).rejects.toThrow('boom')
  })
})

describe('readCurrencyOffers', () => {
  it('reads active flexible offers of the pair, minus hidden sellers', async () => {
    const { client, calls } = fakeClient({
      listings: {
        data: [
          { price: '3.8', quantity: 500, min_quantity: 10, is_unlimited: false },
          { price: 4, quantity: null, min_quantity: null, is_unlimited: true },
        ],
      },
    })
    const offers = await readCurrencyOffers(client, { gameCategoryId: 'pair-9', bundleId: null, hiddenSellerIds: ['s1', 's2'] })
    expect(offers).toEqual([
      { price: 3.8, stock: 500, minQty: 10, unlimited: false },
      { price: 4, stock: 0, minQty: 1, unlimited: true },
    ])
    expect(op(calls, 'listings', 'eq')).toEqual([
      ['game_category_id', 'pair-9'],
      ['status', 'active'],
    ])
    expect(op(calls, 'listings', 'is')).toEqual([['bundle_id', null]])
    expect(op(calls, 'listings', 'not')).toEqual([['seller_id', 'in', '(s1,s2)']])
  })

  it('reads one bundle in bundle mode', async () => {
    const { client, calls } = fakeClient({ listings: { data: [] } })
    await readCurrencyOffers(client, { gameCategoryId: 'pair-2', bundleId: 'b-1000', hiddenSellerIds: [] })
    expect(op(calls, 'listings', 'eq')).toContainEqual(['bundle_id', 'b-1000'])
    expect(op(calls, 'listings', 'not')).toEqual([])
  })
})
