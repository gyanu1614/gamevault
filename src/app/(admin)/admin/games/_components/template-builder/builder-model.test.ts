import { describe, expect, it } from 'vitest'
import type { BuilderAttribute } from '@/lib/actions/admin-template-builder'
import { buildColumns, childFields, choiceMeta, moveId, openChoice, startPath, topFields } from './builder-model'

const attr = (id: string, over: Partial<BuilderAttribute> = {}): BuilderAttribute => ({
  id, template_id: 't', slug: id, name: id, description: null, type: 'select', is_required: false,
  placeholder: null, help_text: null, min_value: null, max_value: null, max_length: null, default_value: null,
  sort_order: 0, facet_indexed: false, options: [], rules: [], ...over,
})
const opt = (attribute_id: string, value: string, sort_order: number) =>
  ({ id: `${attribute_id}-${value}`, attribute_id, slug: value, value, label: value[0].toUpperCase() + value.slice(1), description: null, icon_url: null, metadata: {}, sort_order })
const when = (child: string, parent: string, value: string) =>
  [{ id: `r-${child}`, attribute_id: child, trigger_attribute_id: parent, operator: 'equals' as const, trigger_values: [value] }]

// MM2-like: Item Type → (knives) Rarity → (uncommon) Knife Name; Trait top-level.
const attrs = [
  attr('type', { name: 'Item Type', sort_order: 0, options: [opt('type', 'knives', 0), opt('type', 'guns', 1), opt('type', 'pets', 2)] }),
  attr('trait', { name: 'Trait', sort_order: 1, options: [opt('trait', 'chroma', 0)] }),
  attr('rarity', { name: 'Rarity', sort_order: 2, rules: when('rarity', 'type', 'knives'), options: [opt('rarity', 'common', 0), opt('rarity', 'uncommon', 1)] }),
  attr('kname', { name: 'Knife Name', sort_order: 3, rules: when('kname', 'rarity', 'uncommon'), options: [opt('kname', 'cane', 1), opt('kname', 'silent', 0)] }),
  attr('pname', { name: 'Pet Name', sort_order: 4, rules: when('pname', 'type', 'pets') }),
  attr('pextra', { name: 'Pet Age', sort_order: 5, rules: when('pextra', 'type', 'pets') }),
]

describe('builder-model', () => {
  it('top-level fields are the ones without a rule, in sort order', () => {
    expect(topFields(attrs).map((a) => a.id)).toEqual(['type', 'trait'])
  })
  it('child fields of a choice, in sort order', () => {
    expect(childFields(attrs, 'type', 'pets').map((a) => a.id)).toEqual(['pname', 'pextra'])
    expect(childFields(attrs, 'type', 'guns')).toEqual([])
  })
  it('a choice row says what it opens', () => {
    expect(choiceMeta(attrs, 'type', 'knives')).toEqual({ label: 'Rarity', count: 2, fields: 1 })
    expect(choiceMeta(attrs, 'type', 'pets')).toEqual({ label: 'Pet Name', count: 0, fields: 2 })
    expect(choiceMeta(attrs, 'type', 'guns')).toBeNull()
  })
  it('opening choices walks down the columns', () => {
    let path = openChoice(attrs, [{ fieldId: 'type', value: null }], 0, 'knives')
    expect(path).toEqual([{ fieldId: 'type', value: 'knives' }, { fieldId: 'rarity', value: null }])
    path = openChoice(attrs, path, 1, 'uncommon')
    const cols = buildColumns(attrs, path)
    expect(cols.map((c) => [c.field?.id ?? null, c.parent?.value ?? null])).toEqual([
      ['type', null], ['rarity', 'knives'], ['kname', 'uncommon'],
    ])
    // Choices in admin order (sort_order), not insertion order.
    expect(cols[2].field!.options.map((o) => o.value)).toEqual(['silent', 'cane'])
    expect(cols[0].siblings.map((a) => a.id)).toEqual(['type', 'trait'])
  })
  it('a choice with no field yet opens an empty column to create one', () => {
    const path = openChoice(attrs, [{ fieldId: 'type', value: null }], 0, 'guns')
    const cols = buildColumns(attrs, path)
    expect(cols).toHaveLength(2)
    expect(cols[1]).toMatchObject({ field: null, parent: { fieldId: 'type', value: 'guns' }, siblings: [] })
  })
  it('re-picking higher up drops the deeper columns', () => {
    let path = openChoice(attrs, [{ fieldId: 'type', value: null }], 0, 'knives')
    path = openChoice(attrs, path, 1, 'uncommon')
    path = openChoice(attrs, path, 0, 'pets')
    expect(path).toEqual([{ fieldId: 'type', value: 'pets' }, { fieldId: 'pname', value: null }])
  })
  it('a stale path (field deleted) stops at the last valid column', () => {
    const cols = buildColumns(attrs, [{ fieldId: 'type', value: 'knives' }, { fieldId: 'gone', value: null }])
    expect(cols.map((c) => c.field?.id)).toEqual(['type', 'rarity'])
  })
  it('the page opens down the first branch that has fields under it', () => {
    expect(startPath(attrs)).toEqual([
      { fieldId: 'type', value: 'knives' },
      { fieldId: 'rarity', value: 'uncommon' },
      { fieldId: 'kname', value: null },
    ])
    expect(startPath([])).toEqual([])
    expect(startPath([attrs[1]])).toEqual([{ fieldId: 'trait', value: null }])
  })
  it('moveId reorders for a drag', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
    expect(moveId(['a', 'b'], 'a', 'x')).toEqual(['a', 'b'])
  })
})
