/**
 * The sell form for a game with flat item lists follows its catalogue: Adopt Me
 * (Pet Name, Egg Name, Potion Name) and Steal a Brainrot (one Select Brainrot per
 * rarity). Insert-only, unlike the Murder Mystery 2 chain (plan.ts): field slugs,
 * existing options and listings are never touched, and an option is kept whatever
 * the catalogue says later. On 2026-11-05 these forms were missing 473 of Adopt
 * Me's 809 pets and 141 of Steal a Brainrot's 594 brainrots, so sellers could not
 * pick them. Relative imports only: the tsx CLI loads this file too.
 */
import { comparableName } from '../../values/normalisers/eldorado-structured'
import { emptyReport, OPTION_CAP, type SyncOptions } from './run'
import { loadForm, selectAll, writeForm } from './store'
import type { FormField, FormOption, FormSnapshot, OptionMarker, SellFormPlan, SyncReport } from './types'
import type { Db } from '../types'

/** A catalogue row the form should offer; `group` says which list it belongs in. */
export interface ListEntry {
  slug: string
  name: string
  group: string | null
}

/** A list the form doesn't have yet, with the choice that reveals it. */
export interface NewListField {
  slug: string
  name: string
  parentField: string
  parentValue: string
  parentLabel: string
  /** The new choice sits beside this one. */
  beside: string
}

export type ListPlacement =
  /** group → field slug. */
  | { kind: 'fixed'; fields: Record<string, string>; newFields?: NewListField[] }
  /** group → a choice of `parentField` → the field that choice reveals. */
  | { kind: 'rule'; parentField: string; aliases?: Record<string, string> }

export interface ListSyncConfig {
  gameSlug: string
  placement: ListPlacement
  load: (db: Db, gameId: string) => Promise<ListEntry[]>
}

const nameKey = (name: string) => comparableName(name).replace(/ /g, '')

export const ADOPT_ME_LISTS: ListSyncConfig = {
  gameSlug: 'adopt-me',
  placement: {
    kind: 'fixed',
    fields: { pet: 'pet-name', egg: 'egg-name', potion: 'potion-name' },
    newFields: [{ slug: 'potion-name', name: 'Potion Name', parentField: 'item-type-2', parentValue: 'potions', parentLabel: 'Potions', beside: 'eggs' }],
  },
  load: async (db) => {
    const rows = await selectAll<{ slug: string; name: string; is_active: boolean | null; item_kind: string | null }>('adopt_me_pets', (a, b) =>
      db.from('adopt_me_pets').select('slug,name,is_active,item_kind').order('slug').range(a, b))
    return rows.filter((r) => r.item_kind || r.is_active).map((r) => ({ slug: r.slug, name: r.name, group: r.item_kind ?? 'pet' }))
  },
}

export const STEAL_A_BRAINROT_LISTS: ListSyncConfig = {
  gameSlug: 'steal-a-brainrot',
  placement: { kind: 'rule', parentField: 'rarity', aliases: { mythic: 'mythical', og: 'og-2' } },
  load: async (db) => {
    const rows = await selectAll<{ slug: string; name: string; rarity: string | null }>('sab_brainrot_market_catalog', (a, b) =>
      db.from('sab_brainrot_market_catalog').select('slug,name,rarity').order('slug').range(a, b))
    return rows.map((r) => ({ slug: r.slug, name: r.name, group: r.rarity }))
  },
}

export const LIST_SYNC_CONFIGS: readonly ListSyncConfig[] = [ADOPT_ME_LISTS, STEAL_A_BRAINROT_LISTS]

export function findListSyncConfig(gameSlug: string): ListSyncConfig | null {
  return LIST_SYNC_CONFIGS.find((c) => c.gameSlug === gameSlug) ?? null
}

/** The option of a rule's parent field that means this group ("Mythic" → the choice `mythical`). */
function parentChoice(options: FormOption[], group: string, aliases: Record<string, string> = {}): FormOption | null {
  const key = comparableName(group)
  const alias = aliases[key]
  return options.find((o) => (alias ? o.value === alias : false)) ?? options.find((o) => comparableName(o.label) === key || o.value === key) ?? null
}

export function planListAdditions(config: ListSyncConfig, entries: ListEntry[], form: FormSnapshot): SellFormPlan {
  const plan: SellFormPlan = {
    templateId: form.templateId,
    fieldIds: {},
    createFields: [],
    updateFields: [],
    renamed: [],
    createOptions: [],
    updateOptions: [],
    deleteOptions: [],
    setRules: [],
    typeValues: {},
    warnings: [],
  }
  const fieldsBySlug = new Map(form.fields.map((f) => [f.slug, f]))
  const optionsOf = new Map<string, FormOption[]>()
  for (const o of form.options) optionsOf.set(o.attributeId, [...(optionsOf.get(o.attributeId) ?? []), o])
  const options = (f: FormField | undefined) => (f ? optionsOf.get(f.id) ?? [] : [])

  /** group → the field its rows go in, or null when the form has no list for it. */
  let listFor: (group: string | null) => string | null
  const lists = new Set<string>()
  if (config.placement.kind === 'fixed') {
    const { fields, newFields = [] } = config.placement
    for (const slug of Object.values(fields)) lists.add(slug)
    listFor = (group) => (group ? fields[group] ?? null : null)
    for (const nf of newFields) {
      if (!entries.some((e) => e.group !== null && fields[e.group] === nf.slug)) continue
      const parent = fieldsBySlug.get(nf.parentField)
      if (!parent) {
        plan.warnings.push(`no ${nf.parentField} field, so ${nf.name} could not be added`)
        lists.delete(nf.slug)
        continue
      }
      plan.fieldIds[nf.parentField] = parent.id
      if (!options(parent).some((o) => o.value === nf.parentValue)) {
        const beside = options(parent).find((o) => o.value === nf.beside)
        const marker: OptionMarker = { node: nf.parentField }
        plan.createOptions.push({
          node: nf.parentField,
          option: { slug: nf.parentValue, value: nf.parentValue, label: nf.parentLabel, metadata: { catalogue: marker }, sortOrder: beside?.sortOrder ?? options(parent).length },
        })
      }
      const field = fieldsBySlug.get(nf.slug)
      if (!field) plan.createFields.push({ node: nf.slug, name: nf.name, placeholder: `Search ${nf.name.toLowerCase()}`, sortOrder: 0 })
      if (!field || !form.rules.some((r) => r.attributeId === field.id)) plan.setRules.push({ node: nf.slug, parentNode: nf.parentField, parentValue: nf.parentValue })
    }
  } else {
    const { parentField, aliases } = config.placement
    const parent = fieldsBySlug.get(parentField)
    const revealed = new Map<string, string>()
    for (const r of form.rules) {
      if (!parent || r.triggerAttributeId !== parent.id) continue
      const child = form.fields.find((f) => f.id === r.attributeId)
      const value = r.triggerValues[0]
      if (child && child.type === 'select' && typeof value === 'string') {
        revealed.set(value, child.slug)
        lists.add(child.slug)
      }
    }
    listFor = (group) => {
      const choice = group ? parentChoice(options(parent), group, aliases) : null
      return choice ? revealed.get(choice.value) ?? null : null
    }
  }

  // Across every list: a row already offered in any of them (a brainrot whose rarity changed) is not offered twice.
  const offered = new Set<string>()
  const keysOf = (o: FormOption) => [o.value, o.slug, nameKey(o.label)]
  for (const slug of lists) {
    const field = fieldsBySlug.get(slug)
    if (field) plan.fieldIds[slug] = field.id
    for (const o of options(field)) for (const k of keysOf(o)) offered.add(k)
  }

  const nextSort = new Map<string, number>()
  const unplaced = new Map<string, number>()
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (offered.has(e.slug) || offered.has(nameKey(e.name))) continue
    const node = listFor(e.group)
    if (!node || !lists.has(node)) {
      unplaced.set(e.group ?? 'no group', (unplaced.get(e.group ?? 'no group') ?? 0) + 1)
      continue
    }
    const sort = nextSort.get(node) ?? Math.max(-1, ...options(fieldsBySlug.get(node)).map((o) => o.sortOrder)) + 1
    nextSort.set(node, sort + 1)
    offered.add(e.slug)
    offered.add(nameKey(e.name))
    const marker: OptionMarker = { node, item: e.slug }
    plan.createOptions.push({ node, option: { slug: e.slug, value: e.slug, label: e.name, metadata: { catalogue: marker }, sortOrder: sort } })
  }
  for (const [group, n] of unplaced) plan.warnings.push(`${n} ${n === 1 ? 'item' : 'items'} of "${group}" could not be placed: the form has no list for ${n === 1 ? 'it' : 'them'}`)
  return plan
}

export interface ListSyncDeps {
  db: Db
  /** After any form change: the sell form's cached template and the game's category pages. */
  afterFormChange: ((ctx: { gameId: string; gameCategoryId: string }) => Promise<void>) | null
}

export async function syncSellFormLists(config: ListSyncConfig, deps: ListSyncDeps, opts: SyncOptions): Promise<{ report: SyncReport; plan: SellFormPlan | null }> {
  const report = emptyReport(config.gameSlug, opts.write)
  const loaded = await loadForm(deps.db, config.gameSlug)
  if (!loaded) {
    report.status = 'no_form'
    report.message = 'the game has no active items form'
    return { report, plan: null }
  }
  const entries = await config.load(deps.db, loaded.gameId)
  const plan = planListAdditions(config, entries, loaded.form)
  report.fieldsCreated = plan.createFields.length
  report.rulesSet = plan.setRules.length
  report.optionsCreated = plan.createOptions
    .filter((c) => (c.option.metadata.catalogue as OptionMarker | undefined)?.item)
    .map((c) => ({ node: c.node, label: c.option.label }))
  report.warnings = plan.warnings
  const anything = plan.createFields.length + plan.createOptions.length + plan.setRules.length > 0

  if (!opts.allowLarge && plan.createOptions.length > OPTION_CAP) {
    report.status = 'blocked'
    report.message = `${plan.createOptions.length} new options is over the safety cap (${OPTION_CAP}); check a dry run, then run once with allowLarge`
    return { report, plan }
  }
  if (!opts.write || !anything) {
    // Nothing to add but something it can't place still reaches the owner.
    report.status = anything || plan.warnings.length ? 'ok' : 'nothing_to_do'
    return { report, plan }
  }
  await writeForm(deps.db, plan)
  if (deps.afterFormChange) await deps.afterFormChange({ gameId: loaded.gameId, gameCategoryId: loaded.gameCategoryId })
  report.status = 'ok'
  return { report, plan }
}
