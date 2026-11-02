/**
 * The sell-form sync's decisions, pure: given a game's catalogue and its items
 * form as it is now, what to create, fix, adopt or drop so the form offers
 * exactly the catalogue as Item Type → Rarity → Item.
 *
 * Ownership: a field is the sync's when its slug is a node slug, or when most
 * of its marked options belong to one node (an admin renamed it). An option
 * is the sync's when it carries `metadata.catalogue` or, inside a managed
 * field, resolves to a catalogue item. Everything else is the admin's and is
 * never changed or deleted.
 */
import { comparableName } from '../../values/normalisers/eldorado-structured'
import { listNode, OTHER, rarityNode, raritySlug } from './config'
import type { CatalogueEntry, FieldSpec, FormField, FormOption, FormSnapshot, OptionMarker, SellFormConfig, SellFormPlan, SellFormType } from './types'

const OTHER_LABEL = 'Other'
const nameKey = (name: string) => comparableName(name).replace(/ /g, '')
/** "Drool (Gun)" → "Drool": inside the Gun list the admin may type the short name. */
const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '')
const byLabel = (a: { label: string }, b: { label: string }) => comparableName(a.label).localeCompare(comparableName(b.label))

export function markerOf(o: Pick<FormOption, 'metadata'>): OptionMarker | null {
  const m = (o.metadata as { catalogue?: unknown } | null)?.catalogue
  return m && typeof m === 'object' && typeof (m as OptionMarker).node === 'string' ? (m as OptionMarker) : null
}

/** Key order is not compared: jsonb stores keys in its own order (`item` before `node`). */
const sameMarker = (a: OptionMarker | null, b: OptionMarker) => {
  if (!a) return false
  const ka = Object.keys(a) as (keyof OptionMarker)[]
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}
const withMarker = (metadata: Record<string, unknown>, marker: OptionMarker) => ({ ...metadata, catalogue: marker })

interface RarityGroup {
  slug: string
  label: string
  items: CatalogueEntry[]
}

function rarityGroups(config: SellFormConfig, items: CatalogueEntry[]): RarityGroup[] {
  const groups = new Map<string, RarityGroup>()
  for (const i of items) {
    const slug = i.rarity ? raritySlug(i.rarity) : OTHER
    const g = groups.get(slug) ?? { slug, label: i.rarity ?? OTHER_LABEL, items: [] }
    g.items.push(i)
    groups.set(slug, g)
  }
  const order = (slug: string) => {
    if (slug === OTHER) return Number.MAX_SAFE_INTEGER
    const i = config.rarities.findIndex((r) => raritySlug(r) === slug)
    return i === -1 ? config.rarities.length : i
  }
  return [...groups.values()].sort((a, b) => order(a.slug) - order(b.slug) || a.slug.localeCompare(b.slug))
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function planSellForm(config: SellFormConfig, items: CatalogueEntry[], form: FormSnapshot): SellFormPlan {
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
  // For sale: enabled, and tradeable (an unreleased design or default skin keeps its page, is never sold).
  const sellable = (i: CatalogueEntry) => i.enabled && i.priced !== false
  const enabled = items.filter(sellable)
  const typed = new Map<string, CatalogueEntry[]>(config.types.map((t) => [t.key, []]))
  const untyped = new Map<string, number>()
  for (const i of enabled) {
    const list = i.itemType ? typed.get(i.itemType) : undefined
    if (list) list.push(i)
    else untyped.set(i.itemType ?? 'none', (untyped.get(i.itemType ?? 'none') ?? 0) + 1)
  }
  const catalogueBySlug = new Map(items.map((i) => [i.slug, i]))
  const catalogueByName = new Map(items.map((i) => [nameKey(i.name), i]))
  /** Where an enabled catalogue item belongs in the chain. */
  const homeOf = (i: CatalogueEntry) => (i.itemType && typed.has(i.itemType) ? listNode(i.itemType, i.rarity ? raritySlug(i.rarity) : OTHER) : null)

  const optionsByField = new Map<string, FormOption[]>()
  for (const o of form.options) optionsByField.set(o.attributeId, [...(optionsByField.get(o.attributeId) ?? []), o])
  const fieldsBySlug = new Map(form.fields.map((f) => [f.slug, f]))
  const nodeSlugs = new Set<string>([config.typeField, ...config.types.flatMap((t) => [rarityNode(t.key)])])
  for (const t of config.types) for (const g of rarityGroups(config, typed.get(t.key) ?? [])) nodeSlugs.add(listNode(t.key, g.slug))

  /** A renamed managed field: most of its marked options name this node, and its slug is no node's. */
  const dominantNode = (f: FormField) => {
    const counts = new Map<string, number>()
    for (const o of optionsByField.get(f.id) ?? []) {
      const m = markerOf(o)
      if (m) counts.set(m.node, (counts.get(m.node) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  const resolveField = (node: string, spec: Omit<FieldSpec, 'node'>): string | null => {
    const exact = fieldsBySlug.get(node)
    const field = exact ?? form.fields.find((f) => !nodeSlugs.has(f.slug) && dominantNode(f) === node)
    if (!field) {
      plan.createFields.push({ node, ...spec })
      return null
    }
    const set: Record<string, unknown> = {}
    if (field.slug !== node) {
      set.slug = node
      plan.renamed.push({ node, from: field.slug })
    }
    if (field.type !== 'select') set.type = 'select'
    if (!field.isRequired) set.is_required = true
    if (!field.facetIndexed) set.facet_indexed = true
    if (Object.keys(set).length) plan.updateFields.push({ id: field.id, node, set })
    plan.fieldIds[node] = field.id
    return field.id
  }
  const ensureRule = (node: string, fieldId: string | null, parentNode: string, parentValue: string) => {
    if (fieldId && plan.fieldIds[parentNode]) {
      const rules = form.rules.filter((r) => r.attributeId === fieldId)
      const r = rules[0]
      const ok = rules.length === 1 && r.triggerAttributeId === plan.fieldIds[parentNode] &&
        (r.operator === 'equals' || r.operator === 'in') && r.triggerValues.length === 1 && r.triggerValues[0] === parentValue
      if (ok) return
    }
    plan.setRules.push({ node, parentNode, parentValue })
  }

  // ── Item Type ──────────────────────────────────────────────────────────────
  const typeId = resolveField(config.typeField, { name: config.typeFieldName, placeholder: null, sortOrder: 0 })
  const typeOptions = typeId ? optionsByField.get(typeId) ?? [] : []
  let nextTypeSort = Math.max(-1, ...typeOptions.map((o) => o.sortOrder)) + 1
  const activeTypes: SellFormType[] = config.types.filter((t) => (typed.get(t.key) ?? []).length)
  for (const t of activeTypes) {
    const marker: OptionMarker = { node: config.typeField, type: t.key }
    const aliases = new Set(t.aliases.map((a) => comparableName(a)))
    const hit = typeOptions.find((o) => markerOf(o)?.type === t.key) ??
      typeOptions.find((o) => !markerOf(o) && [o.value, o.slug, o.label].some((v) => aliases.has(comparableName(v))))
    if (hit) {
      plan.typeValues[t.key] = hit.value
      if (!sameMarker(markerOf(hit), marker)) plan.updateOptions.push({ id: hit.id, node: config.typeField, set: { metadata: withMarker(hit.metadata, marker) } })
    } else {
      const value = comparableName(t.label).replace(/ /g, '-')
      plan.typeValues[t.key] = value
      plan.createOptions.push({ node: config.typeField, option: { slug: value, value, label: t.label, metadata: { catalogue: marker }, sortOrder: nextTypeSort++ } })
    }
  }

  // ── Rarity per type, then one item list per (type, rarity) ─────────────────
  for (const t of activeTypes) {
    const rNode = rarityNode(t.key)
    const groups = rarityGroups(config, typed.get(t.key) ?? [])
    const rarityId = resolveField(rNode, { name: 'Rarity', placeholder: null, sortOrder: 1 })
    ensureRule(rNode, rarityId, config.typeField, plan.typeValues[t.key])
    reconcileRarityOptions(rNode, rarityId ? optionsByField.get(rarityId) ?? [] : [], groups)

    for (const g of groups) {
      const lNode = listNode(t.key, g.slug)
      const listId = resolveField(lNode, { name: t.listName, placeholder: `Search ${t.listName.toLowerCase()}`, sortOrder: 2 })
      ensureRule(lNode, listId, rNode, g.slug)
      reconcileListOptions(lNode, listId ? optionsByField.get(listId) ?? [] : [], g.items)
    }
  }

  function reconcileRarityOptions(node: string, existing: FormOption[], groups: RarityGroup[]) {
    const claimed = new Set<string>()
    groups.forEach((g, index) => {
      const marker: OptionMarker = { node, rarity: g.slug }
      const hit = existing.find((o) => !claimed.has(o.id) && (markerOf(o)?.rarity === g.slug || o.value === g.slug || o.slug === g.slug || raritySlug(o.label) === g.slug))
      if (!hit) {
        plan.createOptions.push({ node, option: { slug: g.slug, value: g.slug, label: g.label, metadata: { catalogue: marker }, sortOrder: index } })
        return
      }
      claimed.add(hit.id)
      const set: Record<string, unknown> = {}
      if (!sameMarker(markerOf(hit), marker)) set.metadata = withMarker(hit.metadata, marker)
      if (hit.sortOrder !== index) set.sort_order = index
      if (Object.keys(set).length) plan.updateOptions.push({ id: hit.id, node, set })
    })
    // A rarity the admin added by hand stays (after ours); a marked one whose items are gone is dropped.
    let after = groups.length
    for (const o of existing) {
      if (claimed.has(o.id)) continue
      if (markerOf(o)) plan.deleteOptions.push({ id: o.id, node, value: o.value, reason: 'no items of this rarity' })
      else if (o.sortOrder !== after++) plan.updateOptions.push({ id: o.id, node, set: { sort_order: after - 1 } })
    }
  }

  function reconcileListOptions(node: string, existing: FormOption[], wanted: CatalogueEntry[]) {
    const bySlug = new Map(wanted.map((i) => [i.slug, i]))
    const byName = new Map<string, CatalogueEntry>()
    for (const i of wanted) {
      byName.set(nameKey(i.name), i)
      if (!byName.has(nameKey(shortName(i.name)))) byName.set(nameKey(shortName(i.name)), i)
    }
    const held = new Map<string, FormOption>()
    const rows: { label: string; option?: FormOption; item?: CatalogueEntry; other?: boolean }[] = []
    let otherOption: FormOption | undefined
    // An option already holding an item's slug is the one kept when there are two copies
    // (renaming the other copy onto that slug would hit the (attribute_id, slug) key).
    const exactFirst = [...existing].sort((a, b) => Number(bySlug.has(b.slug)) - Number(bySlug.has(a.slug)))
    for (const o of exactFirst) {
      const m = markerOf(o)
      if (m?.other || o.value === OTHER) {
        if (!otherOption) otherOption = o
        else plan.deleteOptions.push({ id: o.id, node, value: o.value, reason: 'duplicate' })
        continue
      }
      const local = (m?.item && bySlug.get(m.item)) || bySlug.get(o.value) || bySlug.get(o.slug) || byName.get(nameKey(o.label))
      if (local) {
        if (held.has(local.slug)) plan.deleteOptions.push({ id: o.id, node, value: o.value, reason: 'duplicate' })
        else {
          held.set(local.slug, o)
          rows.push({ label: local.name, option: o, item: local })
        }
        continue
      }
      const known = (m?.item && catalogueBySlug.get(m.item)) || catalogueBySlug.get(o.value) || catalogueByName.get(nameKey(o.label))
      if (known && !sellable(known)) plan.deleteOptions.push({ id: o.id, node, value: o.value, reason: known.enabled ? 'not tradeable' : 'disabled in the catalogue' })
      else if (known && homeOf(known)) plan.deleteOptions.push({ id: o.id, node, value: o.value, reason: `belongs in ${homeOf(known)}` })
      else if (m) plan.deleteOptions.push({ id: o.id, node, value: o.value, reason: 'not in the catalogue' })
      else rows.push({ label: o.label, option: o }) // the admin's own option: kept as it is
    }
    for (const i of wanted) if (!held.has(i.slug)) rows.push({ label: i.name, item: i })
    rows.sort(byLabel)
    rows.push({ label: OTHER_LABEL, option: otherOption, other: true })

    rows.forEach((row, index) => {
      if (row.other) {
        const marker: OptionMarker = { node, other: true }
        if (!row.option) plan.createOptions.push({ node, option: { slug: OTHER, value: OTHER, label: OTHER_LABEL, metadata: { catalogue: marker }, sortOrder: index } })
        else {
          const set: Record<string, unknown> = {}
          if (!sameMarker(markerOf(row.option), marker)) set.metadata = withMarker(row.option.metadata, marker)
          if (row.option.sortOrder !== index) set.sort_order = index
          if (Object.keys(set).length) plan.updateOptions.push({ id: row.option.id, node, set })
        }
        return
      }
      if (!row.item) {
        if (row.option && row.option.sortOrder !== index) plan.updateOptions.push({ id: row.option.id, node, set: { sort_order: index } })
        return
      }
      const marker: OptionMarker = { node, item: row.item.slug }
      if (!row.option) {
        plan.createOptions.push({ node, option: { slug: row.item.slug, value: row.item.slug, label: row.item.name, metadata: { catalogue: marker }, sortOrder: index } })
        return
      }
      const o = row.option
      const set: Record<string, unknown> = {}
      if (o.slug !== row.item.slug) set.slug = row.item.slug
      if (o.value !== row.item.slug) set.value = row.item.slug
      if (o.label !== row.item.name) set.label = row.item.name
      if (!sameMarker(markerOf(o), marker)) set.metadata = withMarker(o.metadata, marker)
      if (o.sortOrder !== index) set.sort_order = index
      if (Object.keys(set).length) plan.updateOptions.push({ id: o.id, node, set })
    })
  }

  // ── What the owner should know ─────────────────────────────────────────────
  const noRarity = [...typed.values()].flat().filter((i) => !i.rarity)
  if (noRarity.length) {
    const names = noRarity.slice(0, 8).map((i) => i.name).join(', ') + (noRarity.length > 8 ? ` and ${noRarity.length - 8} more` : '')
    plan.warnings.push(`${noRarity.length} ${plural(noRarity.length, 'item has', 'items have')} no rarity, so ${plural(noRarity.length, 'it is', 'they are')} listed under Other: ${names}`)
  }
  for (const [type, n] of untyped) {
    plan.warnings.push(`${n} ${plural(n, 'item', 'items')} of type "${type}" ${plural(n, 'is', 'are')} not in the sell form (no chain for that type)`)
  }
  return plan
}
