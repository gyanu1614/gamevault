/**
 * Sell-form sync: the contracts (spec:
 * docs/superpowers/specs/2026-10-29-sell-form-catalogue-sync-design.md).
 *
 * The values catalogue is the master; the item part of a game's items form
 * (Item Type → Rarity → Item) is derived from it by one reconcile step. Pure
 * plan here and in plan.ts / repair.ts; I/O in store.ts. Relative imports
 * only: the tsx CLI (scripts/sell-form.mjs) loads these files too.
 */

export interface SellFormType {
  /** values_items.item_type ("knife"). */
  key: string
  /** Item Type option label for a new option ("Knives"). */
  label: string
  /** Existing option values/labels that mean this type ("knife", "knives"). */
  aliases: string[]
  /** Item list field name ("Knife Name"). */
  listName: string
}

export interface SellFormConfig {
  gameSlug: string
  /** Slug of the Item Type field the chain hangs from (adopted, never renamed). */
  typeField: string
  typeFieldName: string
  types: SellFormType[]
  /** Catalogue rarity names in display order; a rarity not listed sorts after them. */
  rarities: string[]
  /**
   * Fields this chain replaces. Their answers move onto the chain (repair.ts);
   * the fields themselves are retired only by the explicit cutover step.
   */
  legacyFields: string[]
}

/** The marker on every option the sync owns (attribute_options.metadata.catalogue). */
export interface OptionMarker {
  node: string
  type?: string
  rarity?: string
  item?: string
  other?: true
}

export interface FormField {
  id: string
  slug: string
  name: string
  type: string
  isRequired: boolean
  facetIndexed: boolean
  sortOrder: number
}

export interface FormOption {
  id: string
  attributeId: string
  slug: string
  value: string
  label: string
  metadata: Record<string, unknown>
  sortOrder: number
}

export interface FormRule {
  id: string
  attributeId: string
  triggerAttributeId: string
  operator: string
  triggerValues: unknown[]
}

export interface FormSnapshot {
  templateId: string
  fields: FormField[]
  options: FormOption[]
  rules: FormRule[]
}

export interface CatalogueEntry {
  slug: string
  name: string
  itemType: string | null
  rarity: string | null
  enabled: boolean
}

/** A field the chain needs; `node` is also its canonical slug. */
export interface FieldSpec {
  node: string
  name: string
  placeholder: string | null
  sortOrder: number
}

export interface OptionSpec {
  slug: string
  value: string
  label: string
  metadata: Record<string, unknown>
  sortOrder: number
}

export interface SellFormPlan {
  templateId: string
  /** node → existing field id; a node missing here is in createFields. */
  fieldIds: Record<string, string>
  createFields: FieldSpec[]
  /** Managed fields whose slug/type/flags drifted (a rename is also listed in `renamed`). */
  updateFields: { id: string; node: string; set: Record<string, unknown> }[]
  renamed: { node: string; from: string }[]
  createOptions: { node: string; option: OptionSpec }[]
  updateOptions: { id: string; node: string; set: Record<string, unknown> }[]
  /** Stray copies and disabled items; the writer skips any a listing still uses. */
  deleteOptions: { id: string; node: string; value: string; reason: string }[]
  /** Managed child fields whose rule must become exactly (parent, equals, value). */
  setRules: { node: string; parentNode: string; parentValue: string }[]
  /** node → the chain's answer value for each type / rarity (repair reads it). */
  typeValues: Record<string, string>
  warnings: string[]
}

export interface ListingRow {
  id: string
  templateData: Record<string, unknown> | null
  valueItemSlug: string | null
}

export interface ListingRepair {
  id: string
  templateData: Record<string, unknown>
  itemSlug: string | null
}

export type SyncStatus = 'ok' | 'nothing_to_do' | 'blocked' | 'no_form' | 'failed'

export interface SyncReport {
  gameSlug: string
  status: SyncStatus
  write: boolean
  fieldsCreated: number
  fieldsUpdated: number
  optionsCreated: { node: string; label: string }[]
  optionsUpdated: number
  optionsDeleted: number
  optionsKept: { node: string; value: string; reason: string }[]
  rulesSet: number
  listingsRepaired: number
  /** Legacy fields removed (no live listing answers them any more) / kept because one still does. */
  fieldsRetired: string[]
  fieldsKeptInUse: string[]
  warnings: string[]
  message: string | null
}
