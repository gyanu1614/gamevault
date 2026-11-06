import { describe, expect, it, vi } from 'vitest'
import { ADOPT_ME_LISTS, STEAL_A_BRAINROT_LISTS, findListSyncConfig, planListAdditions, syncSellFormLists, type ListEntry, type ListSyncConfig } from './lists'
import type { FormField, FormOption, FormRule, FormSnapshot } from './types'
import type { Db } from '../types'

const field = (id: string, slug: string): FormField => ({ id, slug, name: slug, type: 'select', isRequired: false, facetIndexed: false, sortOrder: 0 })
const option = (attributeId: string, value: string, label: string, sortOrder = 0): FormOption => ({ id: `${attributeId}:${value}`, attributeId, slug: value, value, label, metadata: {}, sortOrder })
const rule = (attributeId: string, triggerAttributeId: string, value: string): FormRule => ({ id: `r:${attributeId}`, attributeId, triggerAttributeId, operator: 'equals', triggerValues: [value] })
const entry = (slug: string, name: string, group: string | null): ListEntry => ({ slug, name, group })

const AM_FORM: FormSnapshot = {
  templateId: 'tpl',
  fields: [field('type', 'item-type-2'), field('pets', 'pet-name'), field('eggs', 'egg-name')],
  options: [
    option('type', 'pets', 'Pets', 0), option('type', 'eggs', 'Eggs', 1), option('type', 'other', 'Other', 9),
    option('pets', 'parrot', 'Parrot', 0), option('pets', 'old-owl', 'Owl', 1),
    option('eggs', 'royal-egg', 'Royal Egg', 0),
  ],
  rules: [rule('pets', 'type', 'pets'), rule('eggs', 'type', 'eggs')],
}

const SAB_FORM: FormSnapshot = {
  templateId: 'tpl',
  fields: [field('type', 'item-type'), field('rarity', 'rarity'), field('secret', 'select-brainrot'), field('mythic', 'select-brainrot-7'), field('og', 'select-brainrot-2'), field('mut', 'mutation')],
  options: [
    option('rarity', 'secret', 'Secret'), option('rarity', 'mythical', 'Mythical'), option('rarity', 'og-2', 'OG'), option('rarity', 'admin', 'Admin'),
    option('secret', 'la-vacca', 'La Vacca', 4),
    option('mut', 'gold', 'Gold'),
  ],
  rules: [rule('rarity', 'type', 'brainrot'), rule('secret', 'rarity', 'secret'), rule('mythic', 'rarity', 'mythical'), rule('og', 'rarity', 'og-2'), rule('mut', 'type', 'brainrot')],
}

const added = (plan: ReturnType<typeof planListAdditions>, node: string) => plan.createOptions.filter((c) => c.node === node).map((c) => c.option.value)

describe('planListAdditions: Adopt Me', () => {
  it('adds the pets the form is missing, and never touches what is there', () => {
    const plan = planListAdditions(ADOPT_ME_LISTS, [entry('parrot', 'Parrot', 'pet'), entry('skelicorn', 'Skelicorn', 'pet')], AM_FORM)
    expect(added(plan, 'pet-name')).toEqual(['skelicorn'])
    expect(plan.updateOptions).toEqual([])
    expect(plan.deleteOptions).toEqual([])
    expect(plan.updateFields).toEqual([])
  })

  it('an option an admin named by hand counts: same name, another value', () => {
    expect(added(planListAdditions(ADOPT_ME_LISTS, [entry('owl', 'Owl', 'pet')], AM_FORM), 'pet-name')).toEqual([])
  })

  it('a new option carries the catalogue slug as its value, so the listing links', () => {
    const [c] = planListAdditions(ADOPT_ME_LISTS, [entry('skelicorn', 'Skelicorn', 'pet')], AM_FORM).createOptions
    expect(c.option).toMatchObject({ slug: 'skelicorn', value: 'skelicorn', label: 'Skelicorn', sortOrder: 2, metadata: { catalogue: { node: 'pet-name', item: 'skelicorn' } } })
  })

  it('new rows append in name order', () => {
    const plan = planListAdditions(ADOPT_ME_LISTS, [entry('zebra', 'Zebra', 'pet'), entry('ant', 'Ant', 'pet')], AM_FORM)
    expect(plan.createOptions.map((c) => [c.option.value, c.option.sortOrder])).toEqual([['ant', 2], ['zebra', 3]])
  })

  it('an egg goes in Egg Name', () => {
    expect(added(planListAdditions(ADOPT_ME_LISTS, [entry('moon-egg', 'Moon Egg', 'egg')], AM_FORM), 'egg-name')).toEqual(['moon-egg'])
  })

  it('the first potion adds the type, the list and its rule; a second run adds neither', () => {
    const plan = planListAdditions(ADOPT_ME_LISTS, [entry('fly-potion', 'Fly Potion', 'potion')], AM_FORM)
    expect(plan.createFields.map((f) => f.node)).toEqual(['potion-name'])
    expect(plan.setRules).toEqual([{ node: 'potion-name', parentNode: 'item-type-2', parentValue: 'potions' }])
    expect(added(plan, 'item-type-2')).toEqual(['potions'])
    expect(added(plan, 'potion-name')).toEqual(['fly-potion'])
    expect(plan.fieldIds['item-type-2']).toBe('type')

    const next: FormSnapshot = {
      ...AM_FORM,
      fields: [...AM_FORM.fields, field('potions', 'potion-name')],
      options: [...AM_FORM.options, option('type', 'potions', 'Potions', 1), option('potions', 'fly-potion', 'Fly Potion', 0)],
      rules: [...AM_FORM.rules, rule('potions', 'type', 'potions')],
    }
    const again = planListAdditions(ADOPT_ME_LISTS, [entry('fly-potion', 'Fly Potion', 'potion')], next)
    expect(again.createFields).toEqual([])
    expect(again.createOptions).toEqual([])
    expect(again.setRules).toEqual([])
  })

  it('no potions in the catalogue: the form gets no Potions type', () => {
    const plan = planListAdditions(ADOPT_ME_LISTS, [entry('parrot', 'Parrot', 'pet')], AM_FORM)
    expect(plan.createFields).toEqual([])
    expect(added(plan, 'item-type-2')).toEqual([])
  })

  it('a row with nowhere to go is a warning, never a guess', () => {
    const plan = planListAdditions(ADOPT_ME_LISTS, [entry('mystery', 'Mystery', 'hat')], AM_FORM)
    expect(plan.createOptions).toEqual([])
    expect(plan.warnings[0]).toContain('"hat"')
  })
})

describe('planListAdditions: Steal a Brainrot', () => {
  it('places each brainrot in the list its rarity reveals', () => {
    const plan = planListAdditions(STEAL_A_BRAINROT_LISTS, [
      entry('los-combinasionas', 'Los Combinasionas', 'Secret'),
      entry('toro', 'Toro', 'Mythic'),
      entry('og-one', 'OG One', 'OG'),
    ], SAB_FORM)
    expect(added(plan, 'select-brainrot')).toEqual(['los-combinasionas'])
    expect(added(plan, 'select-brainrot-7')).toEqual(['toro'])
    expect(added(plan, 'select-brainrot-2')).toEqual(['og-one'])
    expect(plan.createOptions.find((c) => c.option.value === 'los-combinasionas')!.option.sortOrder).toBe(5)
  })

  it('a brainrot offered under another rarity is not offered twice', () => {
    expect(planListAdditions(STEAL_A_BRAINROT_LISTS, [entry('la-vacca', 'La Vacca', 'Mythic')], SAB_FORM).createOptions).toEqual([])
  })

  it('never adds to a field the rarity does not reveal', () => {
    const plan = planListAdditions(STEAL_A_BRAINROT_LISTS, [entry('gold', 'Gold', 'Admin')], SAB_FORM)
    expect(plan.createOptions).toEqual([])
    expect(plan.warnings[0]).toContain('"Admin"')
  })

  it('no rarity is a warning', () => {
    expect(planListAdditions(STEAL_A_BRAINROT_LISTS, [entry('x', 'X', null)], SAB_FORM).warnings[0]).toContain('could not be placed')
  })
})

describe('findListSyncConfig', () => {
  it('knows Adopt Me and Steal a Brainrot only', () => {
    expect(findListSyncConfig('adopt-me')?.gameSlug).toBe('adopt-me')
    expect(findListSyncConfig('steal-a-brainrot')?.gameSlug).toBe('steal-a-brainrot')
    expect(findListSyncConfig('murder-mystery-2')).toBeNull()
    expect(findListSyncConfig('steal-an-egg')).toBeNull()
  })
})

describe('syncSellFormLists', () => {
  /** A database with one form: answers each table, records every write. */
  function fakeDb(form: FormSnapshot) {
    const writes: Array<{ table: string; op: string; rows: unknown }> = []
    const rows: Record<string, unknown[]> = {
      games: [{ id: 'g1' }],
      game_categories: [{ id: 'p1' }],
      attribute_templates: [{ id: form.templateId }],
      attributes: form.fields.map((f) => ({ id: f.id, slug: f.slug, name: f.name, type: f.type, is_required: f.isRequired, facet_indexed: f.facetIndexed, sort_order: f.sortOrder })),
      attribute_options: form.options.map((o) => ({ id: o.id, attribute_id: o.attributeId, slug: o.slug, value: o.value, label: o.label, metadata: o.metadata, sort_order: o.sortOrder })),
      attribute_conditional_rules: form.rules.map((r) => ({ id: r.id, attribute_id: r.attributeId, trigger_attribute_id: r.triggerAttributeId, operator: r.operator, trigger_values: r.triggerValues })),
    }
    const db = {
      from(table: string) {
        let write = false
        const b: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'in', 'order', 'range']) b[m] = () => b
        for (const op of ['insert', 'upsert', 'update', 'delete']) {
          b[op] = (payload: unknown) => {
            write = true
            writes.push({ table, op, rows: payload })
            return b
          }
        }
        b.maybeSingle = async () => ({ data: rows[table]?.[0] ?? null, error: null })
        b.then = (ok: (v: unknown) => unknown) => ok({ data: write ? [{ id: `new-${table}`, slug: 'potion-name' }] : rows[table] ?? [], error: null })
        return b
      },
    }
    return { db: db as unknown as Db, writes }
  }
  const config = (entries: ListEntry[]): ListSyncConfig => ({ ...ADOPT_ME_LISTS, load: async () => entries })
  const many = (n: number) => Array.from({ length: n }, (_, i) => entry(`pet-${i}`, `Pet ${i}`, 'pet'))

  it('writes the new options and refreshes the form', async () => {
    const { db, writes } = fakeDb(AM_FORM)
    const afterFormChange = vi.fn(async () => {})
    const { report } = await syncSellFormLists(config([entry('skelicorn', 'Skelicorn', 'pet')]), { db, afterFormChange }, { write: true, allowLarge: false })
    expect(report.status).toBe('ok')
    expect(report.optionsCreated).toEqual([{ node: 'pet-name', label: 'Skelicorn' }])
    expect(writes.map((w) => `${w.table}:${w.op}`)).toEqual(['attribute_options:upsert'])
    expect(afterFormChange).toHaveBeenCalledWith({ gameId: 'g1', gameCategoryId: 'p1' })
  })

  it('a dry run writes nothing', async () => {
    const { db, writes } = fakeDb(AM_FORM)
    const afterFormChange = vi.fn(async () => {})
    const { report } = await syncSellFormLists(config([entry('skelicorn', 'Skelicorn', 'pet')]), { db, afterFormChange }, { write: false, allowLarge: false })
    expect(report.status).toBe('ok')
    expect(writes).toEqual([])
    expect(afterFormChange).not.toHaveBeenCalled()
  })

  it('stops itself over the cap, and writes nothing', async () => {
    const { db, writes } = fakeDb(AM_FORM)
    const { report } = await syncSellFormLists(config(many(301)), { db, afterFormChange: null }, { write: true, allowLarge: false })
    expect(report.status).toBe('blocked')
    expect(report.message).toContain('301')
    expect(writes).toEqual([])
  })

  it('passes the cap only when told to', async () => {
    const { db, writes } = fakeDb(AM_FORM)
    const { report } = await syncSellFormLists(config(many(301)), { db, afterFormChange: null }, { write: true, allowLarge: true })
    expect(report.status).toBe('ok')
    expect(writes).toHaveLength(1)
  })

  it('nothing new: no write and no refresh', async () => {
    const { db, writes } = fakeDb(AM_FORM)
    const afterFormChange = vi.fn(async () => {})
    const { report } = await syncSellFormLists(config([entry('parrot', 'Parrot', 'pet')]), { db, afterFormChange }, { write: true, allowLarge: false })
    expect(report.status).toBe('nothing_to_do')
    expect(writes).toEqual([])
    expect(afterFormChange).not.toHaveBeenCalled()
  })
})
