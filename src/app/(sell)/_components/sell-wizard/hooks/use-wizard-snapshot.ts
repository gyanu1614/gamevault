'use client'

import { useEffect, useRef } from 'react'

import type { GlobalCategory } from '@/lib/actions/new-schema'
import type { SellGameOption } from '@/lib/actions/sell-wizard'
import { safeSession } from '@/lib/safe-storage'

import { WIZARD_SNAPSHOT_KEY, type WizardSnapshot } from '../constants'
import { offerFormFromSnapshot, toSnapshot, type OfferForm } from '../offer-form'
import type { WizardStep } from './use-wizard-steps'

/**
 * Refresh persistence for /sell/new: the draft lives in sessionStorage, so a
 * reload keeps the seller on the same step with the same answers and a closed
 * tab forgets it. Never used in edit mode (it must not clobber a /sell/new
 * draft); a duplicate prefill replaces the draft instead of restoring it.
 *
 * Restoring is two-phase so the step never runs ahead of its data: answers
 * and category first, then the game once the category's games load, then
 * the saved step once what it needs is selected.
 */
export function useWizardSnapshot(input: {
  persist: boolean
  restore: boolean
  categories: GlobalCategory[]
  games: SellGameOption[]
  step: WizardStep
  setStep: (s: WizardStep) => void
  category: GlobalCategory | null
  setCategory: (c: GlobalCategory | null) => void
  game: SellGameOption | null
  setGame: (g: SellGameOption | null) => void
  form: OfferForm
  setForm: (f: OfferForm) => void
}) {
  const { persist, restore, games, step, setStep, category, setCategory, game, setGame, form, setForm } = input
  const hydratedRef = useRef(!restore)
  const pendingGameIdRef = useRef<string | null>(null)
  const pendingStepRef = useRef<WizardStep | null>(null)

  useEffect(() => {
    if (!restore) return
    const raw = safeSession.get(WIZARD_SNAPSHOT_KEY)
    if (raw) {
      try {
        const snap = JSON.parse(raw) as Partial<WizardSnapshot>
        const saved = input.categories.find((c) => c.id === snap.categoryId) ?? null
        if (saved) setCategory(saved)
        pendingGameIdRef.current = snap.gameId ?? null
        pendingStepRef.current = snap.step === 2 || snap.step === 3 ? snap.step : null
        setForm(offerFormFromSnapshot(snap))
      } catch {
        // A corrupt snapshot is dropped; the wizard starts fresh.
      }
    }
    hydratedRef.current = true
    // Mount-only: restoring again later would overwrite the seller's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!pendingGameIdRef.current || games.length === 0) return
    const saved = games.find((g) => g.game_id === pendingGameIdRef.current) ?? null
    if (saved) setGame(saved)
    pendingGameIdRef.current = null
  }, [games, setGame])

  useEffect(() => {
    const target = pendingStepRef.current
    if (target === 2 && category) {
      setStep(2)
      pendingStepRef.current = null
    } else if (target === 3 && category && game) {
      setStep(3)
      pendingStepRef.current = null
    }
  }, [category, game, setStep])

  useEffect(() => {
    if (!persist || !hydratedRef.current) return
    safeSession.set(
      WIZARD_SNAPSHOT_KEY,
      JSON.stringify(toSnapshot(form, { step, categoryId: category?.id ?? null, gameId: game?.game_id ?? null })),
    )
  }, [persist, step, category, game, form])
}

/** Forget the draft (after a publish, so the next /sell/new starts empty). */
export function clearWizardSnapshot() {
  safeSession.remove(WIZARD_SNAPSHOT_KEY)
}
