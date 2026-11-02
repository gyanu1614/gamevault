import { describe, expect, it } from 'vitest'
import type { CatalogueEntry, FormSnapshot, SellFormConfig, SellFormPlan } from './types'
import { planSellForm } from './plan'

const CONFIG: SellFormConfig = {
  gameSlug: 'murder-mystery-2',
  typeField: 'item-type',
  typeFieldName: 'Item Type',
  types: [
    { key: 'knife', label: 'Knives', aliases: ['knife', 'knives'], listName: 'Knife Name' },
    { key: 'gun', label: 'Guns', aliases: ['gun', 'guns'], listName: 'Gun Name' },
  ],
  rarities: ['Common', 'Godly', 'Ancient', 'Chroma'],
  legacyFields: ['select-gun'],
}

const item = (slug: string, name: string, itemType: string | null, rarity: string | null, enabled = true): CatalogueEntry => ({ slug, name, itemType, rarity, enabled })
const ITEMS: CatalogueEntry[] = [
  item('emberbow', 'Emberbow', 'gun', 'Ancient'),
  item('harvester', 'Harvester', 'gun', 'Ancient'),
  item('drool-gun', 'Drool (Gun)', 'gun', 'Common'),
  item('icebreaker', 'Icebreaker', 'knife', 'Godly'),
  item('gingerscythe', 'Gingerscythe', 'knife', null),
]

let seq = 0
const id = (p: string) => `${p}-${++seq}`
const empty = (): FormSnapshot => ({ templateId: 'tpl', fields: [], options: [], rules: [] })

/** Applies a plan to a snapshot the way store.ts writes it (ids minted here). */
function apply(form: FormSnapshot, plan: SellFormPlan): FormSnapshot {
  const next: FormSnapshot = structuredClone(form)
  const ids: Record<string, string> = { ...plan.fieldIds }
  for (const f of plan.createFields) {
    const fid = id('f')
    ids[f.node] = fid
    next.fields.push({ id: fid, slug: f.node, name: f.name, type: 'select', isRequired: true, facetIndexed: true, sortOrder: f.sortOrder })
  }
  for (const u of plan.updateFields) {
    const f = next.fields.find((x) => x.id === u.id)!
    if (typeof u.set.slug === 'string') f.slug = u.set.slug
    if (typeof u.set.type === 'string') f.type = u.set.type
    if (typeof u.set.is_required === 'boolean') f.isRequired = u.set.is_required
    if (typeof u.set.facet_indexed === 'boolean') f.facetIndexed = u.set.facet_indexed
  }
  for (const c of plan.createOptions) {
    next.options.push({ id: id('o'), attributeId: ids[c.node], slug: c.option.slug, value: c.option.value, label: c.option.label, metadata: c.option.metadata, sortOrder: c.option.sortOrder })
  }
  for (const u of plan.updateOptions) {
    const o = next.options.find((x) => x.id === u.id)!
    if (typeof u.set.slug === 'string') o.slug = u.set.slug
    if (typeof u.set.value === 'string') o.value = u.set.value
    if (typeof u.set.label === 'string') o.label = u.set.label
    if (u.set.metadata) o.metadata = u.set.metadata as Record<string, unknown>
    if (typeof u.set.sort_order === 'number') o.sortOrder = u.set.sort_order
  }
  const del = new Set(plan.deleteOptions.map((d) => d.id))
  next.options = next.options.filter((o) => !del.has(o.id))
  for (const r of plan.setRules) {
    const attributeId = ids[r.node]
    next.rules = next.rules.filter((x) => x.attributeId !== attributeId)
    next.rules.push({ id: id('r'), attributeId, triggerAttributeId: ids[r.parentNode], operator: 'equals', triggerValues: [r.parentValue] })
  }
  return next
}

const isNoop = (p: SellFormPlan) =>
  !p.createFields.length && !p.updateFields.length && !p.createOptions.length && !p.updateOptions.length && !p.deleteOptions.length && !p.setRules.length

const field = (form: FormSnapshot, slug: string) => form.fields.find((f) => f.slug === slug)
const optionsOf = (form: FormSnapshot, slug: string) =>
  form.options.filter((o) => o.attributeId === field(form, slug)?.id).sort((a, b) => a.sortOrder - b.sortOrder)
const ruleOf = (form: FormSnapshot, slug: string) => {
  const f = field(form, slug)!
  const rules = form.rules.filter((r) => r.attributeId === f.id)
  return rules.map((r) => `${form.fields.find((x) => x.id === r.triggerAttributeId)?.slug}=${r.triggerValues[0]}`)
}

describe('planSellForm: building the chain from the catalogue', () => {
  it('builds Item Type → Rarity → Item from an empty form, one rule per child', () => {
    const form = apply(empty(), planSellForm(CONFIG, ITEMS, empty()))
    expect(optionsOf(form, 'item-type').map((o) => [o.value, o.label])).toEqual([['knives', 'Knives'], ['guns', 'Guns']])
    expect(optionsOf(form, 'rarity-gun').map((o) => o.value)).toEqual(['common', 'ancient'])
    expect(optionsOf(form, 'gun-ancient').map((o) => o.value)).toEqual(['emberbow', 'harvester', 'other'])
    expect(optionsOf(form, 'gun-ancient').at(-1)?.label).toBe('Other')
    expect(ruleOf(form, 'rarity-gun')).toEqual(['item-type=guns'])
    expect(ruleOf(form, 'gun-ancient')).toEqual(['rarity-gun=ancient'])
    expect(field(form, 'gun-ancient')).toMatchObject({ name: 'Gun Name', facetIndexed: true, isRequired: true })
  })

  it('puts an item with no rarity under Other and says so', () => {
    const plan = planSellForm(CONFIG, ITEMS, empty())
    const form = apply(empty(), plan)
    expect(optionsOf(form, 'rarity-knife').map((o) => o.value)).toEqual(['godly', 'other'])
    expect(optionsOf(form, 'knife-other').map((o) => o.value)).toEqual(['gingerscythe', 'other'])
    expect(plan.warnings.join(' ')).toMatch(/1 item has no rarity.*Gingerscythe/)
  })

  it('is a no-op on the second run', () => {
    const form = apply(empty(), planSellForm(CONFIG, ITEMS, empty()))
    expect(isNoop(planSellForm(CONFIG, ITEMS, form))).toBe(true)
  })

  it('reads a marker the way jsonb returns it (keys reordered) as unchanged', () => {
    const form = apply(empty(), planSellForm(CONFIG, ITEMS, empty()))
    for (const o of form.options) {
      const m = o.metadata.catalogue as Record<string, unknown>
      o.metadata = { catalogue: Object.fromEntries(Object.entries(m).reverse()) }
    }
    expect(isNoop(planSellForm(CONFIG, ITEMS, form))).toBe(true)
  })

  it('adds a newly released item to its list only', () => {
    const form = apply(empty(), planSellForm(CONFIG, ITEMS, empty()))
    const plan = planSellForm(CONFIG, [...ITEMS, item('emberscythe', 'Emberscythe', 'knife', 'Ancient')], form)
    expect(plan.createFields.map((f) => f.node)).toEqual(['knife-ancient'])
    expect(plan.createOptions.filter((c) => c.node === 'knife-ancient').map((c) => c.option.value)).toEqual(['emberscythe', 'other'])
    expect(plan.createOptions.filter((c) => c.node === 'rarity-knife').map((c) => c.option.value)).toEqual(['ancient'])
    expect(plan.deleteOptions).toEqual([])
  })

  it('never offers an item the catalogue marks not tradeable (unreleased, default skins)', () => {
    const rows = [...ITEMS, { ...item('classic-knife', 'Classic Knife', 'knife', null), priced: false }]
    const form = apply(empty(), planSellForm(CONFIG, rows, empty()))
    expect(optionsOf(form, 'knife-other').map((o) => o.value)).toEqual(['gingerscythe', 'other'])
    // An option that already exists for one is dropped (when no listing uses it).
    const list = field(form, 'knife-other')!
    form.options.push({ id: 'old', attributeId: list.id, slug: 'classic-knife', value: 'classic-knife', label: 'Classic Knife', metadata: {}, sortOrder: 5 })
    expect(planSellForm(CONFIG, rows, form).deleteOptions).toEqual([{ id: 'old', node: 'knife-other', value: 'classic-knife', reason: 'not tradeable' }])
  })

  it('reports items of a type the form has no chain for', () => {
    const plan = planSellForm(CONFIG, [...ITEMS, item('cat', 'Cat', 'pet', 'Common')], empty())
    expect(plan.warnings.join(' ')).toMatch(/1 item of type "pet"/)
  })
})

describe('planSellForm: the admin edits the form', () => {
  const built = () => apply(empty(), planSellForm(CONFIG, ITEMS, empty()))

  it('adopts an option the admin added by hand instead of adding a duplicate (label match)', () => {
    const form = built()
    const list = field(form, 'gun-ancient')!
    form.options.push({ id: 'admin-1', attributeId: list.id, slug: 'ember-scythe-gun', value: 'ember-scythe-gun', label: 'Emberscythe', metadata: {}, sortOrder: 9 })
    const next = [...ITEMS, item('emberscythe-gun', 'Emberscythe (Gun)', 'gun', 'Ancient')]
    const plan = planSellForm(CONFIG, next, form)
    expect(plan.createOptions.filter((c) => c.node === 'gun-ancient')).toEqual([])
    const upd = plan.updateOptions.find((u) => u.id === 'admin-1')!
    expect(upd.set).toMatchObject({ slug: 'emberscythe-gun', value: 'emberscythe-gun', label: 'Emberscythe (Gun)' })
    expect((upd.set.metadata as any).catalogue).toEqual({ node: 'gun-ancient', item: 'emberscythe-gun' })
    expect(isNoop(planSellForm(CONFIG, next, apply(form, plan)))).toBe(true)
  })

  it('keeps an option the catalogue does not have yet, untouched, and adopts it once it arrives', () => {
    const form = built()
    const list = field(form, 'gun-ancient')!
    form.options.push({ id: 'admin-2', attributeId: list.id, slug: 'nightbow', value: 'nightbow', label: 'Nightbow', metadata: {}, sortOrder: 1 })
    const plan = planSellForm(CONFIG, ITEMS, form)
    expect(plan.deleteOptions).toEqual([])
    expect(plan.updateOptions.filter((u) => u.id === 'admin-2').every((u) => Object.keys(u.set).join() === 'sort_order')).toBe(true)
    const later = planSellForm(CONFIG, [...ITEMS, item('nightbow', 'Nightbow', 'gun', 'Ancient')], apply(form, plan))
    expect(later.createOptions.filter((c) => c.node === 'gun-ancient')).toEqual([])
    expect(later.updateOptions.find((u) => u.id === 'admin-2')?.set.metadata).toEqual({ catalogue: { node: 'gun-ancient', item: 'nightbow' } })
  })

  it('restores an option, a whole field and a rule the admin deleted, with the same slug and value', () => {
    const form = built()
    const ancient = optionsOf(form, 'rarity-gun').find((o) => o.value === 'ancient')!
    const list = field(form, 'gun-ancient')!
    form.options = form.options.filter((o) => o.id !== ancient.id && o.attributeId !== field(form, 'knife-godly')!.id)
    form.fields = form.fields.filter((f) => f.slug !== 'knife-godly')
    form.rules = form.rules.filter((r) => r.attributeId !== list.id)
    const plan = planSellForm(CONFIG, ITEMS, form)
    expect(plan.createOptions.find((c) => c.node === 'rarity-gun')?.option).toMatchObject({ slug: 'ancient', value: 'ancient' })
    expect(plan.createFields.map((f) => f.node)).toEqual(['knife-godly'])
    expect(plan.setRules).toEqual(expect.arrayContaining([
      { node: 'gun-ancient', parentNode: 'rarity-gun', parentValue: 'ancient' },
      { node: 'knife-godly', parentNode: 'rarity-knife', parentValue: 'godly' },
    ]))
    expect(isNoop(planSellForm(CONFIG, ITEMS, apply(form, plan)))).toBe(true)
  })

  it('renames a managed field back when its key was changed, and says which key it had', () => {
    const form = built()
    field(form, 'gun-ancient')!.slug = 'ancient-guns'
    const plan = planSellForm(CONFIG, ITEMS, form)
    expect(plan.createFields).toEqual([])
    expect(plan.updateFields).toEqual([{ id: field(form, 'ancient-guns')!.id, node: 'gun-ancient', set: { slug: 'gun-ancient' } }])
    expect(plan.renamed).toEqual([{ node: 'gun-ancient', from: 'ancient-guns' }])
  })

  it('moves an item the admin put in the wrong list back, and deletes the stray copy', () => {
    const form = built()
    const emberbow = optionsOf(form, 'gun-ancient').find((o) => o.value === 'emberbow')!
    emberbow.attributeId = field(form, 'gun-common')!.id
    const plan = planSellForm(CONFIG, ITEMS, form)
    expect(plan.createOptions.filter((c) => c.node === 'gun-ancient').map((c) => c.option.value)).toEqual(['emberbow'])
    expect(plan.deleteOptions).toEqual([{ id: emberbow.id, node: 'gun-common', value: 'emberbow', reason: 'belongs in gun-ancient' }])
  })

  it('drops the option of an item disabled in the catalogue', () => {
    const form = built()
    const plan = planSellForm(CONFIG, ITEMS.map((i) => (i.slug === 'harvester' ? { ...i, enabled: false } : i)), form)
    expect(plan.deleteOptions.map((d) => [d.value, d.reason])).toEqual([['harvester', 'disabled in the catalogue']])
  })

  it('never touches fields or options it does not own', () => {
    const form = built()
    const type = field(form, 'item-type')!
    form.options.push({ id: 'fx', attributeId: type.id, slug: 'effects', value: 'effects', label: 'Effects', metadata: {}, sortOrder: 7 })
    form.fields.push({ id: 'manual-f', slug: 'effect-name', name: 'Effect Name', type: 'select', isRequired: false, facetIndexed: false, sortOrder: 3 })
    form.options.push({ id: 'mo', attributeId: 'manual-f', slug: 'sparkles', value: 'sparkles', label: 'Sparkles', metadata: {}, sortOrder: 0 })
    form.rules.push({ id: 'mr', attributeId: 'manual-f', triggerAttributeId: type.id, operator: 'equals', triggerValues: ['effects'] })
    const plan = planSellForm(CONFIG, ITEMS, form)
    expect(isNoop(plan)).toBe(true)
  })
})

describe('planSellForm: adopting an existing hand-made Item Type field', () => {
  it('keeps the admin values (knives/guns), their order and the manual types', () => {
    const form = empty()
    form.fields.push({ id: 'type', slug: 'item-type', name: 'Item Type', type: 'select', isRequired: true, facetIndexed: true, sortOrder: 0 })
    form.options.push(
      { id: 't1', attributeId: 'type', slug: 'knives', value: 'knives', label: 'Knives', metadata: {}, sortOrder: 1 },
      { id: 't2', attributeId: 'type', slug: 'guns', value: 'guns', label: 'Guns', metadata: {}, sortOrder: 2 },
      { id: 't3', attributeId: 'type', slug: 'effects', value: 'effects', label: 'Effects', metadata: {}, sortOrder: 3 },
    )
    const plan = planSellForm(CONFIG, ITEMS, form)
    expect(plan.createFields.map((f) => f.node)).not.toContain('item-type')
    expect(plan.createOptions.filter((c) => c.node === 'item-type')).toEqual([])
    expect(plan.typeValues).toEqual({ knife: 'knives', gun: 'guns' })
    expect(plan.updateOptions.map((u) => [u.id, (u.set.metadata as any)?.catalogue])).toEqual([
      ['t1', { node: 'item-type', type: 'knife' }],
      ['t2', { node: 'item-type', type: 'gun' }],
    ])
    expect(plan.setRules).toEqual(expect.arrayContaining([{ node: 'rarity-gun', parentNode: 'item-type', parentValue: 'guns' }]))
  })
})
