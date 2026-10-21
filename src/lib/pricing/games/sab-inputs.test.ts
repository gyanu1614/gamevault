import { describe, it, expect } from 'vitest'
import { loadSabRepriceInputs } from './sab-inputs'

/**
 * A recording fake: every table read resolves to one short page; the
 * reference RPC returns a fixed document. Records what each read asked for so
 * the test can pin the access pattern (keyset, filters pushed down, the two
 * views from one RPC).
 */
function fakeAdmin() {
  const reads: { table: string; ops: string[] }[] = []
  const rpcs: string[] = []
  const admin = {
    rpc(name: string) {
      rpcs.push(name)
      return Promise.resolve({
        data: {
          catalog: [{ brainrot_id: 'b1', mutation_id: 'm1', mutation_slug: 'default', market_value_usd: 3 }],
          calculator: [{ brainrot_id: 'b1', mutation_id: 'm1', calculated_income_per_second: 10 }],
        },
        error: null,
      })
    },
    from(table: string) {
      const read = { table, ops: [] as string[] }
      reads.push(read)
      const api: Record<string, unknown> = {}
      for (const op of ['select', 'eq', 'gt', 'or', 'order', 'limit']) {
        api[op] = (...args: unknown[]) => {
          read.ops.push(`${op}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`)
          return api
        }
      }
      api.range = () => {
        throw new Error(`OFFSET paging on ${table}`)
      }
      api.then = (resolve: (v: unknown) => void) => resolve({ data: [{ id: `${table}-1` }], error: null })
      return api
    },
  }
  return { admin, reads, rpcs }
}

describe('loadSabRepriceInputs', () => {
  it('reads both reference views with ONE rpc call', async () => {
    const { admin, rpcs, reads } = fakeAdmin()
    const inputs = await loadSabRepriceInputs(admin as never)
    expect(rpcs).toEqual(['sab_reprice_reference'])
    expect(reads.map((r) => r.table)).not.toContain('sab_public_price_catalog')
    expect(reads.map((r) => r.table)).not.toContain('sab_brainrot_mutation_calculator')
    expect(inputs.catalog).toHaveLength(1)
    expect(inputs.calculator[0].calculated_income_per_second).toBe(10)
  })

  it('reads every table by keyset (no OFFSET)', async () => {
    const { admin, reads } = fakeAdmin()
    await loadSabRepriceInputs(admin as never)
    expect(reads.map((r) => r.table).sort()).toEqual([
      'sab_brainrots',
      'sab_market_evidence_display',
      'sab_market_raw_listings',
      'sab_mutations',
      'sab_price_corrections',
    ])
    for (const r of reads) expect(r.ops.some((o) => o.startsWith('limit('))).toBe(true)
  })

  it('pushes the active + matched filter into the raw listings read', async () => {
    const { admin, reads } = fakeAdmin()
    await loadSabRepriceInputs(admin as never)
    const raw = reads.find((r) => r.table === 'sab_market_raw_listings')!
    expect(raw.ops).toContain('eq(listing_status,active)')
    expect(raw.ops).toContain('eq(parse_status,matched)')
    // Only the 4 payload keys, extracted server-side.
    expect(raw.ops.find((o) => o.startsWith('select('))).toMatch(/payload_band_upper:raw_payload->income_band->>upper/)
  })

  it('fails the run when the reference rpc fails', async () => {
    const { admin } = fakeAdmin()
    admin.rpc = () => Promise.resolve({ data: null, error: { message: 'boom' } }) as never
    await expect(loadSabRepriceInputs(admin as never)).rejects.toThrow('sab_reprice_reference: boom')
  })
})
