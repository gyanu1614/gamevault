/**
 * How many live listings use a field's choices, so the admin builder can
 * refuse a delete that would orphan them.
 *
 * Why: listings store a choice's code (`template_data[fieldSlug] = value`).
 * On 2026-10-12 every Adopt Me Trait choice was deleted and re-added; the new
 * choices reused old codes with new meanings (old "r" = Fly Ride, new "r" =
 * Ride) and 29 Fly Ride listings turned into Ride. A choice in use can be
 * renamed (its code stays), never deleted.
 *
 * Admin-only: runs on a delete click, never on a seller or public path.
 */

type AnyClient = { from: (table: string) => any }

/** Statuses a seller can still come back to (a deleted choice would break them). */
export const LIVE_LISTING_STATUSES = ['draft', 'active', 'paused', 'pending_approval', 'changes_requested', 'suspended'] as const

const PAGE = 1000
/** Safety stop for one pair (50k live listings); counts stay a lower bound past it. */
const MAX_PAGES = 50

export function countChoiceUses(rows: ReadonlyArray<{ template_data: unknown }>, fieldSlug: string): Map<string, number> {
  const out = new Map<string, number>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v) out.set(v, (out.get(v) ?? 0) + 1)
  }
  for (const r of rows) {
    const v = (r.template_data as Record<string, unknown> | null)?.[fieldSlug]
    if (Array.isArray(v)) v.forEach(add)
    else add(v)
  }
  return out
}

export interface ChoiceUses {
  name: string
  slug: string
  type: string
  /** choice value → live listings using it */
  byValue: Map<string, number>
}

/** The field's name and slug, and how many live listings of its pair use each choice. */
export async function loadChoiceUses(client: AnyClient, attributeId: string): Promise<ChoiceUses | null> {
  const { data: attr, error: attrErr } = await client
    .from('attributes')
    .select('name, slug, type, template_id')
    .eq('id', attributeId)
    .maybeSingle()
  if (attrErr) throw attrErr
  if (!attr) return null
  const { data: tpl, error: tplErr } = await client
    .from('attribute_templates')
    .select('game_category_id')
    .eq('id', attr.template_id)
    .maybeSingle()
  if (tplErr) throw tplErr
  if (!tpl?.game_category_id) return { name: attr.name, slug: attr.slug, type: attr.type, byValue: new Map() }

  const byValue = new Map<string, number>()
  let after = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = client
      .from('listings')
      .select('id, template_data')
      .eq('game_category_id', tpl.game_category_id)
      .in('status', LIVE_LISTING_STATUSES)
      .order('id')
    if (after) q = q.gt('id', after)
    const { data, error } = await q.limit(PAGE)
    if (error) throw error
    const rows = (data ?? []) as Array<{ id: string; template_data: unknown }>
    for (const [v, n] of countChoiceUses(rows, attr.slug)) byValue.set(v, (byValue.get(v) ?? 0) + n)
    if (rows.length < PAGE) break
    after = rows[rows.length - 1].id
  }
  return { name: attr.name, slug: attr.slug, type: attr.type, byValue }
}

const listings = (n: number) => `${n} live listing${n === 1 ? '' : 's'}`

export function blockedChoicesMessage(used: ReadonlyArray<{ label: string; uses: number }>): string {
  if (used.length === 1) return `“${used[0].label}” is used by ${listings(used[0].uses)}. Rename it instead of deleting it.`
  const total = used.reduce((s, u) => s + u.uses, 0)
  const names = used.slice(0, 3).map((u) => u.label)
  const more = used.length > 3 ? ` and ${used.length - 3} more` : ''
  return `${used.length} of these choices are used by ${listings(total)} (${names.join(', ')}${more}). Rename them, or delete only the unused ones.`
}

export function blockedFieldMessage(name: string, uses: number): string {
  return `“${name}” is used by ${listings(uses)}. Rename it instead of deleting it.`
}

// ─── Guards for the admin builder's writes (null = allowed) ──────────────────

const CHOICE_FIELD_TYPES: ReadonlySet<string> = new Set(['select', 'multiselect', 'image_select'])

interface OptionRow {
  id: string
  attribute_id: string
  slug: string
  value: string | null
  label: string
}

const usesOf = (o: OptionRow, uses: ChoiceUses) =>
  (uses.byValue.get(o.value || o.slug) ?? 0) + (o.value && o.value !== o.slug ? uses.byValue.get(o.slug) ?? 0 : 0)

/** Deleting these choices (by id, or every choice of a field) would orphan live listings? */
export async function guardChoiceDelete(
  client: AnyClient,
  target: { optionIds: readonly string[] } | { attributeId: string; optionIds?: readonly string[] },
): Promise<string | null> {
  let q = client.from('attribute_options').select('id, attribute_id, slug, value, label')
  if ('attributeId' in target) q = q.eq('attribute_id', target.attributeId)
  if (target.optionIds?.length) q = q.in('id', target.optionIds)
  const { data, error } = await q
  if (error) throw error
  const options = (data ?? []) as OptionRow[]
  if (options.length === 0) return null
  const uses = await loadChoiceUses(client, options[0].attribute_id)
  if (!uses) return null
  const used = options.map((o) => ({ label: o.label, uses: usesOf(o, uses) })).filter((u) => u.uses > 0)
  return used.length > 0 ? blockedChoicesMessage(used.sort((a, b) => b.uses - a.uses)) : null
}

/** Deleting this choice field would orphan live listings? (Free-text fields only lose a note.) */
export async function guardFieldDelete(client: AnyClient, attributeId: string): Promise<string | null> {
  const uses = await loadChoiceUses(client, attributeId)
  if (!uses || !CHOICE_FIELD_TYPES.has(uses.type)) return null
  const total = [...uses.byValue.values()].reduce((s, n) => s + n, 0)
  return total > 0 ? blockedFieldMessage(uses.name, total) : null
}

/** Changing a choice's stored code while listings use it would orphan them. */
export async function guardChoiceCodeChange(client: AnyClient, optionId: string, nextValue: string): Promise<string | null> {
  const { data, error } = await client
    .from('attribute_options')
    .select('id, attribute_id, slug, value, label')
    .eq('id', optionId)
    .maybeSingle()
  if (error) throw error
  const o = data as OptionRow | null
  if (!o || (o.value || o.slug) === nextValue) return null
  const uses = await loadChoiceUses(client, o.attribute_id)
  const n = uses ? usesOf(o, uses) : 0
  return n > 0 ? `“${o.label}” is used by ${listings(n)}, so its stored code can't change. Edit the label instead.` : null
}
