import { describe, expect, it, vi } from 'vitest'

/**
 * PostgREST returns at most 1000 rows per request. The MM2 items form has
 * ~1,070 options across its name fields, so a single read silently dropped
 * the tail. This fake enforces the same cap and honours .range().
 */
const CAP = 1000
const OPTION_COUNT = 1067

const db = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
}))

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => ({
    from(table: string) {
      let rows = [...(db.tables[table] ?? [])]
      let from = 0
      let to = Number.POSITIVE_INFINITY
      let single = false
      const b: any = {
        select: () => b,
        eq: (k: string, v: unknown) => { rows = rows.filter((r) => r[k] === v); return b },
        in: (k: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[k])); return b },
        order: () => b,
        range: (f: number, t: number) => { from = f; to = t; return b },
        maybeSingle: () => { single = true; return b },
        then: (resolve: (v: unknown) => void) => {
          if (single) return resolve({ data: rows[0] ?? null, error: null })
          const end = Math.min(to + 1, from + CAP)
          resolve({ data: rows.slice(from, end), error: null })
        },
      }
      return b
    },
  }),
}))

describe('getAttributeTemplateFull', () => {
  it('reads every option even past the 1000-row page cap', async () => {
    db.tables = {
      attribute_templates: [{ id: 't1', game_category_id: 'gc1', is_active: true }],
      attributes: [
        { id: 'a-knife', template_id: 't1', slug: 'select-knife', sort_order: 1 },
        { id: 'a-gun', template_id: 't1', slug: 'select-gun', sort_order: 2 },
      ],
      attribute_options: Array.from({ length: OPTION_COUNT }, (_, i) => ({
        id: `o${String(i).padStart(5, '0')}`,
        attribute_id: i < 700 ? 'a-knife' : 'a-gun',
        value: `item-${i}`,
        sort_order: i,
      })),
      attribute_conditional_rules: [],
    }
    const { getAttributeTemplateFull } = await import('./new-schema')
    const res = await getAttributeTemplateFull('gc1')
    expect(res.success).toBe(true)
    const attrs = (res as any).data.attributes
    expect(attrs.find((a: any) => a.slug === 'select-knife').options).toHaveLength(700)
    expect(attrs.find((a: any) => a.slug === 'select-gun').options).toHaveLength(OPTION_COUNT - 700)
  })
})
