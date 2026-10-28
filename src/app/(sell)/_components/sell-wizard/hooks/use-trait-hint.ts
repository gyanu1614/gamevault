'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AttributeTemplateFull } from '@/lib/actions/new-schema'
import { traitHint, traitHintText, type TraitHint } from '@/lib/adopt-me/trait-hint'
import { isVisible } from '../attribute-tree'
import { nextTraitStep, type TraitFlowState } from '../trait-hint-flow'

/** The title is read once the seller pauses, so "F" on the way to "FR" never picks Fly. */
const TITLE_SETTLE_MS = 400

/** A one-line note under one field, with one action. */
export interface FieldHint {
  attributeId: string
  text: string
  actionLabel: string
  onAction: () => void
}

/**
 * Adopt Me: keeps the Trait pick and the title in step (lib/adopt-me/trait-hint).
 * Pre-selects the title's variant when nothing is picked; returns the
 * mismatch line when the seller's own pick disagrees. Client-side only, on the
 * sell form; nothing reaches the server until the seller saves.
 */
export function useTraitHint(input: {
  gameSlug: string | undefined
  template: AttributeTemplateFull | null
  title: string
  values: Record<string, unknown>
  onFieldChange: (id: string, value: unknown) => void
}): FieldHint | null {
  const { gameSlug, template, title, values, onFieldChange } = input

  const { trait, pet, choices } = useMemo(() => {
    const attrs = gameSlug === 'adopt-me' ? template?.attributes ?? [] : []
    const traitAttr = attrs.find((a) => a.slug === 'trait') ?? null
    return {
      trait: traitAttr,
      pet: attrs.find((a) => a.slug === 'pet-name') ?? null,
      choices: (traitAttr?.options ?? []).map((o) => ({ value: o.value, label: o.label })),
    }
  }, [gameSlug, template])

  const [settledTitle, setSettledTitle] = useState(title)
  useEffect(() => {
    const t = setTimeout(() => setSettledTitle(title), TITLE_SETTLE_MS)
    return () => clearTimeout(t)
  }, [title])

  const rawPick = trait ? values[trait.id] : null
  const picked = typeof rawPick === 'string' && rawPick ? rawPick : null
  const petValue = pet ? values[pet.id] : undefined
  const itemName = pet?.options?.find((o) => o.value === petValue)?.label
  const traitShown = trait ? isVisible(trait, values) : false

  const hint = useMemo(
    () => (trait && traitShown ? traitHint({ title: settledTitle, itemName, picked, choices }) : null),
    [trait, traitShown, settledTitle, itemName, picked, choices],
  )

  const flow = useRef<TraitFlowState>({ auto: null, declined: null })
  const [mismatch, setMismatch] = useState<TraitHint | null>(null)
  useEffect(() => {
    const step = nextTraitStep(hint, picked, flow.current)
    flow.current = step.state
    if (step.set && trait) onFieldChange(trait.id, step.set)
    setMismatch(step.show ?? null)
  }, [hint, picked, trait, onFieldChange])

  return useMemo(() => {
    if (!mismatch || !trait) return null
    return {
      attributeId: trait.id,
      text: traitHintText(mismatch),
      actionLabel: 'Switch',
      onAction: () => onFieldChange(trait.id, mismatch.choice.value),
    }
  }, [mismatch, trait, onFieldChange])
}
