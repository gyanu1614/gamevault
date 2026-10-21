/**
 * Guard: the SAB reprice reads its two reference VIEWS once (2026-10-20 usage
 * audit, C1).
 *
 * sab_public_price_catalog sits on a SECURITY DEFINER function Postgres cannot
 * inline, and sab_brainrot_mutation_calculator is a brainrots × mutations
 * cross join. Paged 1000 rows at a time, each page recomputed the whole view:
 * 4 + 8 full recomputes per reprice. sab_reprice_reference() returns both as
 * one jsonb document, each view computed once.
 */
import { describe, it, expect } from 'vitest'
import { DB_IS_LOCAL, runRolledBack } from './local-psql'

const TAG = 'guardtest-reprice-ref'

describe.skipIf(!DB_IS_LOCAL)('sab_reprice_reference()', () => {
  it('returns the catalog and the calculator as arrays', () => {
    const [shape] = runRolledBack([
      `select jsonb_typeof(r -> 'catalog') || '/' || jsonb_typeof(r -> 'calculator') from public.sab_reprice_reference() r`,
    ])
    expect(shape).toBe('array/array')
  })

  it('carries the calculator columns the reprice reads', () => {
    const lines = runRolledBack([
      `insert into public.sab_brainrots (name, slug, base_income_per_second, is_active, needs_review) values ('${TAG}', '${TAG}', 100, true, false)`,
      `insert into public.sab_mutations (name, slug, income_multiplier, is_active) values ('${TAG}', '${TAG}', 2, true)`,
      `select e ->> 'calculated_income_per_second'
         from public.sab_reprice_reference() r, jsonb_array_elements(r -> 'calculator') e
        where e ->> 'brainrot_id' = (select id::text from public.sab_brainrots where slug = '${TAG}')
          and e ->> 'mutation_id' = (select id::text from public.sab_mutations where slug = '${TAG}')`,
    ])
    expect(lines).toEqual(['200'])
  })

  it('is not callable by a browser session', () => {
    const lines = runRolledBack([
      `select has_function_privilege('anon', 'public.sab_reprice_reference()', 'execute')::text || '/' ||
              has_function_privilege('authenticated', 'public.sab_reprice_reference()', 'execute')::text`,
    ])
    expect(lines).toEqual(['false/false'])
  })
})
