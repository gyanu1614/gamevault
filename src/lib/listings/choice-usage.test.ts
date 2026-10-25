import { describe, expect, it } from 'vitest'
import { blockedChoicesMessage, blockedFieldMessage, countChoiceUses, guardChoiceCodeChange, guardChoiceDelete, guardFieldDelete, loadChoiceUses } from './choice-usage'

describe('countChoiceUses', () => {
  it('counts single picks and multi-picks under one field', () => {
    const rows = [
      { template_data: { trait: 'fr', 'pet-name': 'frost-dragon' } },
      { template_data: { trait: 'fr' } },
      { template_data: { trait: 'r' } },
      { template_data: { colours: ['red', 'blue'] } },
      { template_data: null },
    ]
    expect(countChoiceUses(rows, 'trait')).toEqual(new Map([['fr', 2], ['r', 1]]))
    expect(countChoiceUses(rows, 'colours')).toEqual(new Map([['red', 1], ['blue', 1]]))
    expect(countChoiceUses(rows, 'missing').size).toBe(0)
  })
})

describe('messages', () => {
  it('one choice', () => {
    expect(blockedChoicesMessage([{ label: 'FR', uses: 12 }])).toBe(
      '“FR” is used by 12 live listings. Rename it instead of deleting it.',
    )
    expect(blockedChoicesMessage([{ label: 'FR', uses: 1 }])).toBe('“FR” is used by 1 live listing. Rename it instead of deleting it.')
  })

  it('several choices', () => {
    expect(
      blockedChoicesMessage([
        { label: 'FR', uses: 30 },
        { label: 'R', uses: 3 },
        { label: 'NFR', uses: 1 },
        { label: 'MFR', uses: 1 },
      ]),
    ).toBe('4 of these choices are used by 35 live listings (FR, R, NFR and 1 more). Rename them, or delete only the unused ones.')
  })

  it('a whole field', () => {
    expect(blockedFieldMessage('Trait', 41)).toBe('“Trait” is used by 41 live listings. Rename it instead of deleting it.')
  })
})

describe('loadChoiceUses', () => {
  it('reads the field, then pages through live listings of its pair', async () => {
    const pages = [
      Array.from({ length: 1000 }, (_, i) => ({ id: `a${String(i).padStart(4, '0')}`, template_data: { trait: 'fr' } })),
      [{ id: 'b0001', template_data: { trait: 'r' } }],
    ]
    const calls: string[] = []
    const chain = (data: unknown) => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'gt']) q[m] = (...a: unknown[]) => (calls.push(`${m}:${String(a[0])}`), q)
      q.maybeSingle = async () => ({ data, error: null })
      q.limit = async () => ({ data: pages.shift() ?? [], error: null })
      return q
    }
    const client = {
      from: (t: string) =>
        t === 'attributes'
          ? chain({ name: 'Trait', slug: 'trait', template_id: 't1' })
          : t === 'attribute_templates'
            ? chain({ game_category_id: 'gc1' })
            : chain(null),
    }
    const out = await loadChoiceUses(client, 'attr-1')
    expect(out).toMatchObject({ name: 'Trait', slug: 'trait' })
    expect(out!.byValue).toEqual(new Map([['fr', 1000], ['r', 1]]))
    expect(calls).toContain('eq:game_category_id')
    expect(calls).toContain('in:status')
    expect(calls).toContain('gt:id')
  })
})

describe('guards', () => {
  // A tiny PostgREST stand-in: options, the field, its template, and live listings.
  function db(listings: Array<{ id: string; template_data: unknown }>) {
    const options = [
      { id: 'o-fr', attribute_id: 'trait', slug: 'fr', value: 'fr', label: 'FR' },
      { id: 'o-r', attribute_id: 'trait', slug: 'r', value: 'r', label: 'R' },
      { id: 'o-mr', attribute_id: 'trait', slug: 'mr', value: 'mr', label: 'MR' },
    ]
    const table = (rows: Array<Record<string, unknown>>) => {
      let out = rows
      const q: Record<string, any> = {
        select: () => q,
        order: () => q,
        gt: () => q,
        eq: (col: string, v: unknown) => ((out = out.filter((r) => col in r ? r[col] === v : true)), q),
        in: (col: string, vs: unknown[]) => ((out = out.filter((r) => col in r ? vs.includes(r[col]) : true)), q),
        maybeSingle: async () => ({ data: out[0] ?? null, error: null }),
        limit: async () => ({ data: out, error: null }),
        then: (res: (v: unknown) => void) => res({ data: out, error: null }),
      }
      return q
    }
    return {
      from: (t: string) =>
        t === 'attribute_options'
          ? table(options)
          : t === 'attributes'
            ? table([{ id: 'trait', name: 'Trait', slug: 'trait', type: 'select', template_id: 't1' }])
            : t === 'attribute_templates'
              ? table([{ id: 't1', game_category_id: 'gc1' }])
              : table(listings),
    }
  }
  const live = [
    { id: 'l1', template_data: { trait: 'fr' } },
    { id: 'l2', template_data: { trait: 'fr' } },
    { id: 'l3', template_data: { trait: 'r' } },
  ]

  it('blocks "Delete All" while listings use the choices (the 2026-10-12 incident)', async () => {
    expect(await guardChoiceDelete(db(live), { attributeId: 'trait' })).toBe(
      '2 of these choices are used by 3 live listings (FR, R). Rename them, or delete only the unused ones.',
    )
  })

  it('blocks one used choice, allows an unused one', async () => {
    expect(await guardChoiceDelete(db(live), { optionIds: ['o-fr'] })).toBe('“FR” is used by 2 live listings. Rename it instead of deleting it.')
    expect(await guardChoiceDelete(db(live), { optionIds: ['o-mr'] })).toBeNull()
  })

  it('blocks deleting a choice field in use; allows it once no listing uses it', async () => {
    expect(await guardFieldDelete(db(live), 'trait')).toBe('“Trait” is used by 3 live listings. Rename it instead of deleting it.')
    expect(await guardFieldDelete(db([]), 'trait')).toBeNull()
  })

  it('blocks changing a used choice’s stored code; a label edit never reaches this guard', async () => {
    expect(await guardChoiceCodeChange(db(live), 'o-r', 'ride')).toBe(
      '“R” is used by 1 live listing, so its stored code can\'t change. Edit the label instead.',
    )
    expect(await guardChoiceCodeChange(db(live), 'o-r', 'r')).toBeNull()
    expect(await guardChoiceCodeChange(db(live), 'o-mr', 'mega-ride')).toBeNull()
  })
})
