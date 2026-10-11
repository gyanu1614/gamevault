import { type Attribute } from '@/lib/actions/new-schema'

/**
 * Pure visibility check (mirrors LivePreview / new-schema.ts/isAttributeVisible).
 *
 * V15c — Walks the full ancestor chain so a stale value on a now-hidden
 * parent can't keep a descendant on screen. If the third arg is provided,
 * we look up parent attributes by id; otherwise we fall back to the
 * shallow rule check (preserves call sites that don't have the full list).
 */
export function isVisible(
  attr: Attribute,
  values: Record<string, unknown>,
  byId?: Map<string, Attribute>,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(attr.id)) return true
  seen.add(attr.id)
  const rules = attr.conditional_rules ?? []
  if (rules.length === 0) return true
  for (const r of rules) {
    if (byId) {
      const parent = byId.get(r.trigger_attribute_id)
      if (parent && !isVisible(parent, values, byId, seen)) return false
    }
    const cur = values[r.trigger_attribute_id]
    const trig = r.trigger_values ?? []
    let pass = false
    switch (r.operator) {
      case 'equals':     pass = trig.length > 0 && cur === trig[0]; break
      case 'not_equals': pass = trig.length > 0 && cur !== trig[0]; break
      case 'in':         pass = trig.includes(cur as string); break
      case 'not_in':     pass = !trig.includes(cur as string); break
    }
    if (!pass) return false
  }
  return true
}

/**
 * V15c — Collect every descendant attribute id of a parent. Used when
 * the user changes a parent value so we can wipe stale sub-selections
 * (e.g. switching Item Type from Brainrot → Base Skin clears both Rarity
 * and the leaf "Brainrot" selection).
 */
export function collectDescendantIds(parentId: string, attrs: Attribute[]): Set<string> {
  const out = new Set<string>()
  let frontier = new Set<string>([parentId])
  let safety = 0
  while (frontier.size > 0 && safety++ < 32) {
    const next = new Set<string>()
    for (const a of attrs) {
      if (out.has(a.id)) continue
      const rules = a.conditional_rules ?? []
      for (const r of rules) {
        if (frontier.has(r.trigger_attribute_id)) {
          out.add(a.id)
          next.add(a.id)
          break
        }
      }
    }
    frontier = next
  }
  return out
}

/** Build parent → (triggerValue → children[]) index, just like the admin tree. */
export function buildChildIndex(attrs: Attribute[]) {
  const childrenOf = new Map<string, Map<string, Attribute[]>>()
  const childIds = new Set<string>()
  for (const a of attrs) {
    if (!a.conditional_rules || a.conditional_rules.length === 0) continue
    childIds.add(a.id)
    const r = a.conditional_rules[0]
    const triggerVal = r.trigger_values[0] ?? ''
    const inner = childrenOf.get(r.trigger_attribute_id) ?? new Map<string, Attribute[]>()
    const list = inner.get(triggerVal) ?? []
    list.push(a)
    inner.set(triggerVal, list)
    childrenOf.set(r.trigger_attribute_id, inner)
  }
  childrenOf.forEach((inner) => {
    inner.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order))
  })
  const topLevel = attrs.filter((a) => !childIds.has(a.id)).sort((a, b) => a.sort_order - b.sort_order)
  return { topLevel, childrenOf }
}

export function walkAndClear(
  attr: Attribute,
  childrenOf: Map<string, Map<string, Attribute[]>>,
  out: Record<string, unknown>,
) {
  const inner = childrenOf.get(attr.id)
  if (!inner) return
  inner.forEach((kids) => {
    kids.forEach((k) => {
      delete out[k.id]
      walkAndClear(k, childrenOf, out)
    })
  })
}

export function labelFor(attr: Attribute, value: string): string {
  if (attr.type === 'boolean') return value === 'true' ? 'Yes' : 'No'
  const opt = attr.options?.find((o) => o.value === value)
  return opt?.label ?? value
}
