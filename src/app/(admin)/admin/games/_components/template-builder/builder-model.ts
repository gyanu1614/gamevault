/**
 * The Finder builder's shape, pure (no React): which field each column shows
 * and what a choice opens. The tree lives in the existing tables — a field is
 * a sub-field of (parent, choice) when its FIRST rule is
 * `trigger = parent, operator equals|in, values ∋ choice` (the same reading
 * the seller form uses, attribute-tree.ts). No schema change.
 *
 * A path is one step per column: the field that column shows, and the choice
 * picked in it (null = nothing picked yet, so no column to its right).
 */
import type { BuilderAttribute } from '@/lib/actions/admin-template-builder'

export interface PathStep {
  fieldId: string
  value: string | null
}

export interface Column {
  /** The field whose choices this column lists (null: a choice with no field yet). */
  field: BuilderAttribute | null
  /** The fields that share this column's slot (the switcher tabs). */
  siblings: BuilderAttribute[]
  /** The choice that opened this column; null for the first. */
  parent: { fieldId: string; value: string } | null
  /** The choice picked in this column. */
  value: string | null
}

const bySort = (a: { sort_order: number; id: string }, b: { sort_order: number; id: string }) =>
  a.sort_order - b.sort_order || a.id.localeCompare(b.id)

function parentOf(a: BuilderAttribute): { fieldId: string; values: string[] } | null {
  const r = a.rules[0]
  if (!r || (r.operator !== 'equals' && r.operator !== 'in')) return null
  return { fieldId: r.trigger_attribute_id, values: r.trigger_values }
}

/** Fields shown on their own (no rule), in admin order. */
export function topFields(attrs: readonly BuilderAttribute[]): BuilderAttribute[] {
  return attrs.filter((a) => a.rules.length === 0).sort(bySort)
}

/** Fields shown when `fieldId` is `value`, in admin order. */
export function childFields(attrs: readonly BuilderAttribute[], fieldId: string, value: string): BuilderAttribute[] {
  return attrs
    .filter((a) => {
      const p = parentOf(a)
      return !!p && p.fieldId === fieldId && p.values.includes(value)
    })
    .sort(bySort)
}

/** What a choice row says it opens: "Rarity · 8", or null when nothing yet. */
export function choiceMeta(attrs: readonly BuilderAttribute[], fieldId: string, value: string) {
  const kids = childFields(attrs, fieldId, value)
  if (kids.length === 0) return null
  return { label: kids[0].name, count: kids[0].options.length, fields: kids.length }
}

const sortedOptions = (a: BuilderAttribute): BuilderAttribute => ({
  ...a,
  options: [...a.options].sort(bySort),
})

/** The columns to draw for a path. A stale step (deleted field) ends the walk. */
export function buildColumns(attrs: readonly BuilderAttribute[], path: readonly PathStep[]): Column[] {
  const cols: Column[] = []
  let siblings = topFields(attrs)
  let parent: Column['parent'] = null
  for (let i = 0; ; i++) {
    const step = path[i]
    const own = step ? siblings.find((s) => s.id === step.fieldId) : undefined
    const field = own ?? siblings[0] ?? null
    const value = own && step?.value != null && field?.options.some((o) => o.value === step.value) ? step.value : null
    cols.push({ field: field ? sortedOptions(field) : null, siblings, parent, value })
    if (!field || value == null) return cols
    parent = { fieldId: field.id, value }
    siblings = childFields(attrs, field.id, value)
  }
}

/** Pick `value` in column `col`: deeper columns go, and its first sub-field opens. */
export function openChoice(attrs: readonly BuilderAttribute[], path: readonly PathStep[], col: number, value: string): PathStep[] {
  const cols = buildColumns(attrs, path)
  const field = cols[col]?.field
  if (!field) return [...path]
  const next: PathStep[] = cols.slice(0, col).map((c) => ({ fieldId: c.field!.id, value: c.value }))
  next.push({ fieldId: field.id, value })
  const kids = childFields(attrs, field.id, value)
  if (kids.length > 0) next.push({ fieldId: kids[0].id, value: null })
  return next
}

/** Show another field in column `col` (the switcher tabs). */
export function showField(attrs: readonly BuilderAttribute[], path: readonly PathStep[], col: number, fieldId: string): PathStep[] {
  const cols = buildColumns(attrs, path)
  return [...cols.slice(0, col).map((c) => ({ fieldId: c.field!.id, value: c.value })), { fieldId, value: null }]
}

/** The order after dragging `from` onto `to` (unknown ids: unchanged). */
export function moveId(ids: readonly string[], from: string, to: string): string[] {
  const a = ids.indexOf(from)
  const b = ids.indexOf(to)
  if (a < 0 || b < 0 || a === b) return [...ids]
  const next = [...ids]
  next.splice(a, 1)
  next.splice(b, 0, from)
  return next
}

/**
 * Where the page opens (owner, 2026-10-12: one lone column looked empty):
 * down the first choice that has fields under it, column after column, so
 * the admin lands on a filled Finder (Item Type › Knives › Rarity › …).
 */
export function startPath(attrs: readonly BuilderAttribute[]): PathStep[] {
  const path: PathStep[] = []
  let field = topFields(attrs)[0]
  const seen = new Set<string>()
  while (field && !seen.has(field.id)) {
    seen.add(field.id)
    const opened = [...field.options].sort(bySort).find((o) => childFields(attrs, field!.id, o.value).length > 0)
    path.push({ fieldId: field.id, value: opened?.value ?? null })
    if (!opened) break
    field = childFields(attrs, field.id, opened.value)[0]
  }
  return path
}
