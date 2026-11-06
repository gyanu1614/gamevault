/**
 * Listing repair, pure: a listing's chain answers (Item Type, Rarity, Item)
 * follow the catalogue item it sells, whatever happened to the form. The item
 * comes from the value link, else from an item answer under a chain key, a
 * renamed key or a legacy key. Only chain and legacy keys are rewritten; the
 * rest of `template_data` is kept as it is.
 */
import { comparableName } from '../../values/normalisers/eldorado-structured'
import { listFieldSlugs, listNode, OTHER, rarityNode, raritySlug } from './config'
import type { CatalogueEntry, ListingRepair, ListingRow, SellFormConfig, SellFormPlan } from './types'

const nameKey = (name: string) => comparableName(name).replace(/ /g, '')
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

function sameAnswers(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
}

export function planListingRepairs(
  config: SellFormConfig,
  items: CatalogueEntry[],
  plan: Pick<SellFormPlan, 'typeValues' | 'renamed'>,
  listings: ListingRow[],
): ListingRepair[] {
  const bySlug = new Map(items.map((i) => [i.slug, i]))
  const byName = new Map(items.map((i) => [nameKey(i.name), i]))
  const rarities = new Set([...config.rarities.map(raritySlug), OTHER])
  const listKeys = new Set(listFieldSlugs(config))
  for (const i of items) if (i.itemType && i.rarity) listKeys.add(listNode(i.itemType, raritySlug(i.rarity)))
  const renamedFrom = new Set(plan.renamed.map((r) => r.from))
  const legacy = new Set(config.legacyFields)
  const retired = new Set(config.retiredFields ?? [])
  /** Keys that may hold the item answer, most specific first. */
  const itemKeys = [...listKeys, ...renamedFrom, ...config.legacyFields]
  const chainKeys = new Set([...listKeys, ...config.types.map((t) => rarityNode(t.key))])
  const typeOf = (value: unknown): string | null => {
    const v = str(value)
    if (!v) return null
    const t = config.types.find((x) => plan.typeValues[x.key] === v || x.aliases.some((a) => comparableName(a) === comparableName(v)))
    return t?.key ?? null
  }

  const out: ListingRepair[] = []
  for (const l of listings) {
    const data = l.templateData ?? {}
    let target = l.valueItemSlug ? bySlug.get(l.valueItemSlug) ?? null : null
    if (!target) {
      for (const k of itemKeys) {
        const v = str(data[k])
        if (!v || rarities.has(v)) continue
        const hit = bySlug.get(v) ?? byName.get(nameKey(v))
        if (hit) {
          target = hit
          break
        }
      }
    }

    /** Null: the chain answers stay as they are (a retired answer may still go). */
    let desired: Record<string, string> | null = null
    const type = target?.itemType && plan.typeValues[target.itemType] ? target.itemType : null
    if (target && type) {
      const r = target.rarity ? raritySlug(target.rarity) : OTHER
      desired = { [config.typeField]: plan.typeValues[type], [rarityNode(type)]: r, [listNode(type, r)]: target.slug }
    } else {
      // No catalogue item: only an old-form answer is worth moving (keep type + rarity, item → Other).
      target = null
      const t = Object.keys(data).some((k) => legacy.has(k) || renamedFrom.has(k)) ? typeOf(data[config.typeField]) : null
      const own = t ? str(data[rarityNode(t)]) : null
      const r = own && rarities.has(own) ? own : config.legacyFields.map((k) => str(data[k])).find((v) => v && rarities.has(v)) ?? null
      if (t && plan.typeValues[t] && r) {
        const key = listNode(t, r)
        desired = { [config.typeField]: plan.typeValues[t], [rarityNode(t)]: r, [key]: str(data[key]) ?? OTHER }
      }
    }

    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      if (retired.has(k)) continue
      if (desired && (chainKeys.has(k) || legacy.has(k) || renamedFrom.has(k)) && !(k in desired)) continue
      next[k] = v
    }
    if (desired) Object.assign(next, desired)
    if (!sameAnswers(data, next)) out.push({ id: l.id, templateData: next, itemSlug: target?.slug ?? null })
  }
  return out
}
