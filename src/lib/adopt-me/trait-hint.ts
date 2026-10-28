/**
 * Adopt Me: what the listing title says about the Trait pick. The seller's
 * pick stays the source of truth (owner, 2026-10-14):
 *
 *   picked FR,      title "FR Frost Dragon" → nothing
 *   picked nothing, title "Frost Dragon"    → nothing
 *   picked nothing, title "FR Frost Dragon" → 'preselect' FR (the seller can change it)
 *   picked R,       title "FR Frost Dragon" → 'mismatch': one line, the pick stays
 *
 * One rule for the sell form, the publish/edit warning and the admin mismatch
 * list. Pure; choices are matched by LABEL, never by stored code.
 */
import { VARIANT_LABEL, variantFromChoiceLabel, type Variant } from './variants'
import { variantFromTitle } from './variant-from-title'

export interface TraitChoice {
  value: string
  label: string
}

export interface TraitHint {
  kind: 'preselect' | 'mismatch'
  /** What the title says. */
  titleVariant: Variant
  /** The choice to pre-select or switch to. */
  choice: TraitChoice
}

export function traitHint(input: {
  title: string
  itemName?: string
  picked: string | null | undefined
  choices: readonly TraitChoice[]
}): TraitHint | null {
  const titleVariant = variantFromTitle(input.title, { itemName: input.itemName })
  if (!titleVariant) return null
  const choice = input.choices.find((c) => variantFromChoiceLabel(c.label) === titleVariant)
  if (!choice) return null
  if (!input.picked) return { kind: 'preselect', titleVariant, choice }
  if (input.picked === choice.value) return null
  return { kind: 'mismatch', titleVariant, choice }
}

/** How a title writes each variant, for the hint line. */
const TITLE_WORD: Record<Variant, string> = {
  N: 'no potion',
  F: 'F',
  R: 'R',
  FR: 'FR',
  NEON: 'Neon',
  NFR: 'NFR',
  MEGA: 'Mega Neon',
  MFR: 'MFR',
}

/** "Your title says FR. Switch to Fly Ride?" */
export function traitHintText(hint: TraitHint): string {
  return `Your title says ${TITLE_WORD[hint.titleVariant]}. Switch to ${VARIANT_LABEL[hint.titleVariant]}?`
}

/** The Trait field's key in a listing's `template_data`. */
export const AM_TRAIT_FIELD = 'trait'

export interface SavedTraitMismatch {
  /** The stored choice code. */
  picked: string
  /** Its label today, or null when the field no longer offers it. */
  pickedLabel: string | null
  hint: TraitHint
}

/**
 * A SAVED listing whose Trait pick the title disagrees with (the admin list,
 * the publish/edit warning). `traitLabels`: the field's choices, code → label.
 */
export function savedTraitMismatch(input: {
  title: string
  itemName?: string
  templateData: Record<string, unknown> | null | undefined
  traitLabels: Record<string, string> | undefined
}): SavedTraitMismatch | null {
  const raw = input.templateData?.[AM_TRAIT_FIELD]
  if (typeof raw !== 'string' || !raw) return null
  const labels = input.traitLabels ?? {}
  const choices = Object.entries(labels).map(([value, label]) => ({ value, label }))
  const hint = traitHint({ title: input.title, itemName: input.itemName, picked: raw, choices })
  if (hint?.kind !== 'mismatch') return null
  return { picked: raw, pickedLabel: Object.hasOwn(labels, raw) ? labels[raw] : null, hint }
}
