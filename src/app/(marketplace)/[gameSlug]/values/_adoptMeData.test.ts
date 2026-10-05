import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The Adopt Me loaders must read past PostgREST's 1000-row cap. A fake anon
 * client serves tables that enforce that cap (a request for more than 1000
 * rows gets 1000, like max_rows) — so an unpaged select silently loses rows
 * exactly as production would.
 */

const MAX_ROWS = 1000
const VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR']

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const rangeCalls: Array<{ table: string; from: number; to: number }> = []

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = []
  const orders: Array<{ col: string; asc: boolean }> = []
  let range: [number, number] | null = null
  const builder: any = {
    select: () => builder,
    eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), builder),
    neq: (col: string, v: unknown) => (filters.push((r) => r[col] !== v), builder),
    order: (col: string, o?: { ascending?: boolean }) => (
      orders.push({ col, asc: o?.ascending !== false }), builder
    ),
    range: (from: number, to: number) => {
      range = [from, to]
      rangeCalls.push({ table, from, to })
      return builder
    },
    maybeSingle: () => {
      const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
      return Promise.resolve({ data: rows[0] ?? null, error: null })
    },
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      try {
        let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
        rows = rows.slice().sort((a, b) => {
          for (const { col, asc } of orders) {
            const x = String(a[col])
            const y = String(b[col])
            if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1)
          }
          return 0
        })
        const [from, to] = range ?? [0, rows.length - 1]
        const capped = rows.slice(from, Math.min(to + 1, from + MAX_ROWS))
        resolve({ data: capped, error: null })
      } catch (err) {
        reject(err)
      }
    },
  }
  return builder
}

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => ({ from: (table: string) => query(table) }),
  // The loaders read through the tagged client (lib/values/read-client.ts).
  createTaggedAnonClient: () => ({ from: (table: string) => query(table) }),
}))

function seed(petCount: number) {
  const pets: Row[] = []
  const values: Row[] = []
  for (let i = 0; i < petCount; i += 1) {
    const id = `pet-${String(i).padStart(4, '0')}`
    pets.push({
      id,
      slug: `pet-${i}`,
      name: `Pet ${i}`,
      rarity: 'legendary',
      image_url: null,
      has_page: true,
      is_active: true,
      demand_rank: null,
    })
    for (const variant of VARIANTS) {
      values.push({
        pet_id: id,
        variant,
        trade_value: 10,
        cash_value_usd: null,
        cheapest_usd: variant === 'FR' ? 2 + i : null,
        average_usd: variant === 'FR' ? 3 + i : null,
        is_estimated: variant !== 'FR',
        confidence: 'low',
      })
    }
  }
  tables.adopt_me_pets = pets
  tables.adopt_me_pet_values = values
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  rangeCalls.length = 0
})

describe('Adopt Me loaders page past the 1000-row cap', () => {
  it('values list: every pet keeps all 8 variants (300 pets = 2,400 value rows)', async () => {
    seed(300)
    const { getAdoptMePets } = await import('./_adoptMeData')
    const pets = await getAdoptMePets()
    expect(pets).toHaveLength(300)
    for (const pet of pets) expect(Object.keys(pet.values).sort()).toEqual([...VARIANTS].sort())
    // The last pet (whose rows sit past row 2000) is priced.
    expect(pets.find((p) => p.slug === 'pet-299')?.values.FR?.cashUsd).toBe(302)
    expect(rangeCalls.filter((c) => c.table === 'adopt_me_pet_values')).toHaveLength(3)
  })

  it('calculator: every pet keeps its variants', async () => {
    seed(300)
    const { getAdoptMeCalcPets } = await import('../calculator/_adoptMeCalcData')
    const pets = await getAdoptMeCalcPets()
    expect(pets).toHaveLength(300)
    expect(pets.every((p) => Object.keys(p.values).length === 8)).toBe(true)
  })

  it('pet page: price history keeps the NEWEST days past 1000 rows', async () => {
    seed(1)
    const history: Row[] = []
    for (let d = 0; d < 200; d += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)
      for (const variant of VARIANTS) {
        history.push({ pet_id: 'pet-0000', variant, cash_value_usd: d + 1, history_date: date })
      }
    }
    tables.adopt_me_pets[0].description = 'x'.repeat(250)
    tables.adopt_me_pets[0].obtainability = 'obtainable'
    tables.adopt_me_price_history = history // 1,600 rows
    const { getAdoptMePet } = await import('./[itemSlug]/_adoptMePetData')
    const pet = await getAdoptMePet('pet-0')
    const fr = pet?.priceHistory.FR ?? []
    expect(fr).toHaveLength(200)
    expect(fr[fr.length - 1]).toEqual({ date: '2026-07-19', price: 200 })
  })
})
