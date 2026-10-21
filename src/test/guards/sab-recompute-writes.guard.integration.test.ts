/**
 * Guard: the SAB reprice's two recompute steps write only rows that change
 * (2026-10-20 usage audit, C9/17).
 *   * sab_recompute_tradeable rewrote every sab_brainrots row each run.
 *   * sab_publish_market_estimates re-deactivated observations that were
 *     already inactive.
 * Rolled-back transactions on the local stack.
 */
import { describe, it, expect } from 'vitest'
import { DB_IS_LOCAL, runRolledBack } from './local-psql'

const TAG = 'guardtest-recompute'

describe.skipIf(!DB_IS_LOCAL)('sab_recompute_tradeable', () => {
  it('updates a brainrot whose tradeable flag is wrong, then nothing on a second run', () => {
    const lines = runRolledBack([
      // No publishable correction and no popularity rank: should be false.
      `insert into public.sab_brainrots (name, slug, is_tradeable) values ('${TAG}', '${TAG}', true)`,
      `select public.sab_recompute_tradeable()`,
      `select public.sab_recompute_tradeable()`,
      `select is_tradeable from public.sab_brainrots where slug = '${TAG}'`,
    ])
    expect(lines).toEqual(['1', '0', 'f'])
  })
})

describe.skipIf(!DB_IS_LOCAL)('sab_publish_market_estimates', () => {
  it('leaves an already-inactive automated observation untouched', () => {
    const lines = runRolledBack([
      `insert into public.sab_brainrots (name, slug) values ('${TAG}', '${TAG}')`,
      `insert into public.sab_mutations (name, slug) values ('${TAG}', '${TAG}')`,
      `insert into public.sab_external_market_observations
         (brainrot_id, mutation_id, observation_type, source_name, source_reference, price_usd, observed_at, is_active, updated_at)
       select b.id, m.id, 'market_range', 'Automated multi-market estimate', 'auto-multi-market:' || b.id || ':' || m.id, 5,
              '2026-01-01T00:00:00Z', false, '2026-01-01T00:00:00Z'
       from public.sab_brainrots b, public.sab_mutations m where b.slug = '${TAG}' and m.slug = '${TAG}'`,
      `select public.sab_publish_market_estimates()`,
      `select to_char(updated_at at time zone 'utc', 'YYYY-MM-DD') from public.sab_external_market_observations
        where source_reference like 'auto-multi-market:%' and brainrot_id = (select id from public.sab_brainrots where slug = '${TAG}')`,
    ])
    expect(lines.at(-1)).toBe('2026-01-01')
  })
})
