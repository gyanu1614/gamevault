/**
 * Sell-form sync I/O (service role): read a game's items form, catalogue and
 * live listings; write a plan. Idempotent repair, no transaction: a run cut
 * short is completed by the next one (the plan is recomputed from scratch).
 */
import { LIVE_LISTING_STATUSES } from '../../listings/choice-usage'
import type { Db } from '../types'
import type { CatalogueEntry, FormSnapshot, ListingRepair, ListingRow, SellFormPlan } from './types'

const PAGE = 1000

export async function selectAll<T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

export interface LoadedForm {
  gameId: string
  gameCategoryId: string
  form: FormSnapshot
}

/** The game's active items form, or null when the game has none (nothing to sync). */
export async function loadForm(db: Db, gameSlug: string): Promise<LoadedForm | null> {
  const { data: game, error: gErr } = await db.from('games').select('id').eq('slug', gameSlug).maybeSingle()
  if (gErr) throw new Error(`games ${gameSlug}: ${gErr.message}`)
  if (!game) return null
  const { data: gc, error: cErr } = await db.from('game_categories').select('id').eq('game_id', game.id).eq('type', 'items').maybeSingle()
  if (cErr) throw new Error(`game_categories: ${cErr.message}`)
  if (!gc) return null
  const { data: tpl, error: tErr } = await db.from('attribute_templates').select('id').eq('game_category_id', gc.id).eq('is_active', true).maybeSingle()
  if (tErr) throw new Error(`attribute_templates: ${tErr.message}`)
  if (!tpl) return null

  const fields = await selectAll<any>('attributes', (a, b) =>
    db.from('attributes').select('id,slug,name,type,is_required,facet_indexed,sort_order').eq('template_id', tpl.id).order('id').range(a, b))
  const ids = fields.map((f) => f.id)
  const [options, rules] = ids.length
    ? await Promise.all([
        selectAll<any>('attribute_options', (a, b) =>
          db.from('attribute_options').select('id,attribute_id,slug,value,label,metadata,sort_order').in('attribute_id', ids).order('id').range(a, b)),
        selectAll<any>('attribute_conditional_rules', (a, b) =>
          db.from('attribute_conditional_rules').select('id,attribute_id,trigger_attribute_id,operator,trigger_values').in('attribute_id', ids).order('id').range(a, b)),
      ])
    : [[], []]
  return {
    gameId: game.id,
    gameCategoryId: gc.id,
    form: {
      templateId: tpl.id,
      fields: fields.map((f) => ({ id: f.id, slug: f.slug, name: f.name, type: f.type, isRequired: f.is_required, facetIndexed: f.facet_indexed, sortOrder: f.sort_order })),
      options: options.map((o) => ({ id: o.id, attributeId: o.attribute_id, slug: o.slug, value: o.value, label: o.label, metadata: o.metadata ?? {}, sortOrder: o.sort_order })),
      rules: rules.map((r) => ({ id: r.id, attributeId: r.attribute_id, triggerAttributeId: r.trigger_attribute_id, operator: r.operator, triggerValues: Array.isArray(r.trigger_values) ? r.trigger_values : [] })),
    },
  }
}

/** Every catalogue row, disabled ones too (a disabled item's option is dropped, not orphaned). */
export async function loadCatalogue(db: Db, gameId: string): Promise<CatalogueEntry[]> {
  const rows = await selectAll<any>('values_items', (a, b) =>
    db.from('values_items').select('slug,name,item_type,rarity,is_enabled,is_priced').eq('game_id', gameId).order('slug').range(a, b))
  return rows.map((r) => ({
    slug: r.slug, name: r.name, itemType: r.item_type ?? null, rarity: r.rarity ?? null,
    enabled: r.is_enabled !== false, priced: r.is_priced !== false,
  }))
}

/** Listings a seller can still come back to (choice-usage's set). */
export async function loadListings(db: Db, gameCategoryId: string): Promise<ListingRow[]> {
  const rows = await selectAll<any>('listings', (a, b) =>
    db.from('listings').select('id,template_data,value_item_slug').eq('game_category_id', gameCategoryId).in('status', [...LIVE_LISTING_STATUSES]).order('id').range(a, b))
  return rows.map((r) => ({ id: r.id, templateData: r.template_data ?? null, valueItemSlug: r.value_item_slug ?? null }))
}

export interface WriteResult {
  fieldIds: Record<string, string>
  kept: { node: string; value: string; reason: string }[]
  deleted: number
}

/** Fields → field fixes → options → option fixes → rules. Deletes run last (writeDeletes). */
export async function writeForm(db: Db, plan: SellFormPlan): Promise<Record<string, string>> {
  const ids: Record<string, string> = { ...plan.fieldIds }
  if (plan.createFields.length) {
    const { data, error } = await db
      .from('attributes')
      .insert(plan.createFields.map((f) => ({
        template_id: plan.templateId, slug: f.node, name: f.name, type: 'select', is_required: true,
        facet_indexed: true, sort_order: f.sortOrder, placeholder: f.placeholder,
      })))
      .select('id,slug')
    if (error) throw new Error(`attributes insert: ${error.message}`)
    for (const r of data ?? []) ids[r.slug] = r.id
  }
  for (const u of plan.updateFields) {
    const { error } = await db.from('attributes').update(u.set).eq('id', u.id)
    if (error) throw new Error(`attributes update ${u.node}: ${error.message}`)
  }
  const rows = plan.createOptions.map(({ node, option: o }) => ({
    attribute_id: ids[node], slug: o.slug, value: o.value, label: o.label, metadata: o.metadata, sort_order: o.sortOrder,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('attribute_options').upsert(rows.slice(i, i + 500), { onConflict: 'attribute_id,slug', ignoreDuplicates: true })
    if (error) throw new Error(`attribute_options insert: ${error.message}`)
  }
  for (const u of plan.updateOptions) {
    const { error } = await db.from('attribute_options').update(u.set).eq('id', u.id)
    if (error) throw new Error(`attribute_options update ${u.node}: ${error.message}`)
  }
  for (const r of plan.setRules) {
    const attributeId = ids[r.node]
    const { error: dErr } = await db.from('attribute_conditional_rules').delete().eq('attribute_id', attributeId)
    if (dErr) throw new Error(`rules reset ${r.node}: ${dErr.message}`)
    const { error } = await db.from('attribute_conditional_rules').insert({
      attribute_id: attributeId, trigger_attribute_id: ids[r.parentNode], operator: 'equals', trigger_values: [r.parentValue],
    })
    if (error) throw new Error(`rules insert ${r.node}: ${error.message}`)
  }
  return ids
}

export async function writeRepairs(db: Db, repairs: ListingRepair[]): Promise<void> {
  for (const r of repairs) {
    const { error } = await db.from('listings').update({ template_data: r.templateData }).eq('id', r.id)
    if (error) throw new Error(`listings repair ${r.id}: ${error.message}`)
  }
}

/** Legacy fields the chain replaced (their options and rules cascade). */
export async function retireFields(db: Db, fieldIds: string[]): Promise<void> {
  if (!fieldIds.length) return
  const { error } = await db.from('attributes').delete().in('id', fieldIds)
  if (error) throw new Error(`attributes retire: ${error.message}`)
}

/** Drops a planned option only when no listing (any status) still answers with it. */
export async function writeDeletes(db: Db, plan: SellFormPlan, gameCategoryId: string): Promise<Pick<WriteResult, 'kept' | 'deleted'>> {
  const kept: WriteResult['kept'] = []
  let deleted = 0
  for (const d of plan.deleteOptions) {
    const { data, error } = await db.from('listings').select('id').eq('game_category_id', gameCategoryId).contains('template_data', { [d.node]: d.value }).limit(1)
    if (error) throw new Error(`listings usage ${d.node}: ${error.message}`)
    if (data?.length) {
      kept.push({ node: d.node, value: d.value, reason: `${d.reason}, but a listing still uses it` })
      continue
    }
    const { error: delErr } = await db.from('attribute_options').delete().eq('id', d.id)
    if (delErr) throw new Error(`attribute_options delete ${d.node}: ${delErr.message}`)
    deleted++
  }
  return { kept, deleted }
}
