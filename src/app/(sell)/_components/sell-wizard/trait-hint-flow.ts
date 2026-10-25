/**
 * The sell form's side of the Adopt Me title hint (owner, 2026-10-14): what
 * to do with a `TraitHint` as the seller types. Pure, so the hook stays thin.
 *
 *   'preselect' → pick the choice for them, once per title variant; if they
 *                 clear it, it stays cleared.
 *   'mismatch'  → if the pick is the one WE made and the title changed, follow
 *                 the title; if the seller picked it, show the line and keep it.
 */
import type { TraitHint } from '@/lib/adopt-me/trait-hint'
import type { Variant } from '@/lib/adopt-me/variants'

export interface TraitFlowState {
  /** The pick this form made from the title (not the seller). */
  auto: { variant: Variant; value: string } | null
  /** A title variant whose pre-select the seller removed. */
  declined: Variant | null
}

export interface TraitStep {
  /** Set the Trait field to this choice value. */
  set?: string
  /** Show the one-line mismatch hint. */
  show?: TraitHint
  state: TraitFlowState
}

export function nextTraitStep(hint: TraitHint | null, picked: string | null, state: TraitFlowState): TraitStep {
  if (!hint) return { state }
  const ours = (h: TraitHint) => ({ variant: h.titleVariant, value: h.choice.value })

  if (hint.kind === 'preselect') {
    if (state.declined === hint.titleVariant) return { state }
    // Our pick is gone: the seller cleared it.
    if (state.auto?.variant === hint.titleVariant && !picked) return { state: { ...state, declined: hint.titleVariant } }
    return { set: hint.choice.value, state: { auto: ours(hint), declined: null } }
  }

  if (state.auto && picked === state.auto.value) return { set: hint.choice.value, state: { auto: ours(hint), declined: null } }
  return { show: hint, state }
}
