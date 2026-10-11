/**
 * Step 4 bulk importer — filling the game's own filter attributes.
 *
 * A game's items page filters on `listings.template_data`, keyed by the slug of
 * each attribute in the admin-built template (Item Type, Pet Name, Trait, …).
 * The client filter is strict: when a buyer picks a value, a listing WITHOUT
 * that attribute is hidden (`_ItemsPageClient.tsx`, `if (!listingValue)
 * return false`). So an imported listing with empty template_data does not
 * merely miss a facet — it vanishes the moment anyone filters.
 *
 * The rule this follows: write EXACTLY what a seller clicking the same labels
 * in the sell wizard would store. Concretely:
 *
 *   · options are matched on their LABEL — the thing a person reads — never on
 *     their stored value. Production's Adopt Me Trait template (2026-10-10)
 *     stores `r` under the label "Fly Ride (FR)", `fr` under "Neon", `mfr`
 *     under "Mega Neon". Matching on values would tag a Mega Fly Ride pet as
 *     "Mega Neon" and a plain Ride pet as "Fly Ride". Matching on labels gives
 *     the same stored value a seller gets, whatever the codes say.
 *   · the option's VALUE is written, which is what the wizard writes.
 *   · conditional attributes follow the wizard's own show/hide rules
 *     (`shouldShowAttribute`: every rule must pass; equals / not_equals / in /
 *     not_in against stored values). Egg Name is only shown when Item Type is
 *     eggs, so a pet row neither fills nor warns about it.
 *
 * Three sources, in order, per visible select attribute:
 *   1. a config hint naming the attribute ("item type" → Pets)
 *   2. the row's variant, by label ("Fly Ride (FR)" ↔ FR / Fly Ride)
 *   3. the matched catalogue item, by label or slug (Pet Name ↔ Frost Dragon)
 *
 * Refuses to guess: no match → left empty and reported, so the preview says
 * "won't show under the Pet Name filter" instead of the listing silently
 * disappearing from filtered results later.
 *
 * Pure: the caller loads the template and passes it in.
 */
import type { CatalogueVariant } from './types'

/** The attribute types the items page turns into filter dropdowns. */
const FILTER_TYPES = new Set(['select', 'multiselect', 'image_select'])

export interface ConditionalRuleLike {
  trigger_attribute_id: string
  operator: string
  trigger_values: string[] | null
}

export interface TemplateAttributeLike {
  /** Needed to evaluate show/hide rules; optional for templates without any. */
  id?: string
  slug: string
  name: string
  type: string
  options?: Array<{ slug: string; value: string; label: string }>
  /** Rules where THIS attribute is the one shown or hidden. */
  conditional_rules?: ConditionalRuleLike[]
}

export interface ResolveTemplateInput {
  variant: CatalogueVariant | null
  /** The matched catalogue item — fills an item-name attribute (Pet Name). */
  item?: { ref: string; name: string } | null
  /**
   * Fixed values every listing of this game carries, keyed by attribute name or
   * slug (matched loosely), e.g. `{ 'item type': 'Pets' }`. From the game's
   * import config.
   */
  hints?: Record<string, string>
}

export interface ResolvedTemplateData {
  /** attribute slug → option value. Ready to write as `template_data`. */
  data: Record<string, string>
  /** Names of VISIBLE filter attributes left empty — for a preview warning. */
  unfilled: string[]
}

type Option = NonNullable<TemplateAttributeLike['options']>[number]

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** "Fly Ride (FR)" → { base: "flyride", code: "fr" }. */
function splitLabel(label: string): { base: string; code: string | null } {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  return m ? { base: norm(m[1]), code: norm(m[2]) } : { base: norm(label), code: null }
}

/**
 * The option whose LABEL names this variant: its parenthesised code ("(FR)" ↔
 * FR) or its words ("Fly Ride" ↔ Fly Ride). Exact only — "Fly Ride" must not
 * land on "Neon Fly Ride (NFR)", and "Neon" must not either.
 */
function optionForVariant(options: Option[], v: CatalogueVariant): Option | null {
  const ref = norm(v.ref)
  const label = norm(v.label)
  for (const o of options) {
    const { base, code } = splitLabel(o.label)
    if (code !== null && code === ref) return o
    if (base === label) return o
    // A label that IS the code ("NFR"), with nothing in brackets.
    if (code === null && base === ref) return o
  }
  return null
}

/** The option naming this catalogue item — by label, or by slug convention. */
function optionForItem(options: Option[], item: { ref: string; name: string }): Option | null {
  const name = norm(item.name)
  const ref = norm(item.ref)
  // Label first (what a person picks); the slug convention (`frost-dragon`)
  // is a safe second for item names, which unlike variant codes are unique.
  return (
    options.find((o) => norm(o.label) === name) ??
    options.find((o) => norm(o.value) === ref || norm(o.slug) === ref) ??
    null
  )
}

/** A hint names a fixed value; match it on the label first, then value / slug. */
function optionForHint(options: Option[], wanted: string): Option | null {
  const w = norm(wanted)
  return (
    options.find((o) => norm(o.label) === w) ??
    options.find((o) => norm(o.value) === w || norm(o.slug) === w) ??
    null
  )
}

function hintFor(attr: TemplateAttributeLike, hints: Record<string, string>): string | null {
  const keys = [norm(attr.name), norm(attr.slug)]
  for (const [k, v] of Object.entries(hints)) {
    if (keys.includes(norm(k))) return v
  }
  return null
}

/** The wizard's `shouldShowAttribute`, over values keyed by attribute id. */
function isVisible(attr: TemplateAttributeLike, valuesById: Record<string, string>): boolean {
  for (const r of attr.conditional_rules ?? []) {
    const cur = valuesById[r.trigger_attribute_id]
    const trig = r.trigger_values ?? []
    let pass = false
    switch (r.operator) {
      case 'equals':     pass = trig.length > 0 && cur === trig[0]; break
      case 'not_equals': pass = trig.length > 0 && cur !== trig[0]; break
      case 'in':         pass = cur !== undefined && trig.includes(cur); break
      case 'not_in':     pass = cur === undefined || !trig.includes(cur); break
    }
    if (!pass) return false
  }
  return true
}

export function resolveTemplateData(
  attributes: TemplateAttributeLike[],
  input: ResolveTemplateInput,
): ResolvedTemplateData {
  const hints = input.hints ?? {}
  const filters = attributes.filter((a) => FILTER_TYPES.has(a.type) && (a.options ?? []).length > 0)

  const data: Record<string, string> = {}
  const valuesById: Record<string, string> = {}
  const decided = new Set<TemplateAttributeLike>()

  // Fill in dependency order: an attribute is decided once its show/hide rules
  // can be evaluated against what is filled so far. Unconditional ones go
  // first; a child (Pet Name) follows its parent (Item Type). Bounded by the
  // attribute count, so a rule cycle cannot loop forever.
  for (let pass = 0; pass <= filters.length && decided.size < filters.length; pass += 1) {
    for (const attr of filters) {
      if (decided.has(attr)) continue
      const triggers = (attr.conditional_rules ?? []).map((r) => r.trigger_attribute_id)
      const waiting = triggers.some((t) => {
        const parent = filters.find((f) => f.id === t)
        return parent !== undefined && !decided.has(parent)
      })
      if (waiting && pass < filters.length) continue
      decided.add(attr)
      if (!isVisible(attr, valuesById)) continue

      const options = attr.options ?? []
      const hint = hintFor(attr, hints)
      const picked =
        hint != null
          ? optionForHint(options, hint) // a hint is the config's word: no fallthrough
          : (input.variant ? optionForVariant(options, input.variant) : null) ??
            (input.item ? optionForItem(options, input.item) : null)

      if (picked) {
        data[attr.slug] = picked.value
        if (attr.id) valuesById[attr.id] = picked.value
      }
    }
  }

  // Report only what a buyer could actually filter on for this listing.
  const unfilled = filters
    .filter((a) => isVisible(a, valuesById) && data[a.slug] === undefined)
    .map((a) => a.name)

  return { data, unfilled }
}
