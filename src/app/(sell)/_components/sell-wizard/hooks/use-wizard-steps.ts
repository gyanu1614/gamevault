'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

export type WizardStep = 1 | 2 | 3

/** Space kept above the wizard when a step change scrolls it into view (clears the fixed bar). */
const WIZARD_TOP_OFFSET = 168

/**
 * The current step and everything tied to it:
 *  - slide direction (forward enters from the right, back from the left);
 *  - browser history, so the back gesture walks 3 → 2 → 1 → previous page
 *    (skipped in edit mode: there is nothing to step back to);
 *  - scrolling the wizard's top into view on a user step change (never on
 *    the first paint, which should show the top of the page).
 */
export function useWizardSteps(input: { initialStep: WizardStep; historyEnabled: boolean; cardRef: RefObject<HTMLElement | null> }) {
  const { historyEnabled, cardRef } = input
  const [step, setStep] = useState<WizardStep>(input.initialStep)

  const lastStepRef = useRef<WizardStep>(input.initialStep)
  const direction = step >= lastStepRef.current ? 1 : -1
  useEffect(() => {
    lastStepRef.current = step
  }, [step])

  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (!cardRef.current) return
    const top = cardRef.current.getBoundingClientRect().top + window.scrollY - WIZARD_TOP_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
  }, [step, cardRef])

  const popstateGuardRef = useRef(false)
  useEffect(() => {
    if (!historyEnabled) return
    window.history.replaceState({ ...window.history.state, wizardStep: lastStepRef.current }, '')
    const onPop = (e: PopStateEvent) => {
      const target = (e.state as { wizardStep?: number } | null)?.wizardStep
      if (target === 1 || target === 2 || target === 3) {
        popstateGuardRef.current = true
        setStep(target)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [historyEnabled])

  useEffect(() => {
    if (!historyEnabled) return
    if (popstateGuardRef.current) {
      popstateGuardRef.current = false
      return
    }
    const current = (window.history.state as { wizardStep?: number } | null)?.wizardStep
    if (current === step) return
    window.history.pushState({ ...window.history.state, wizardStep: step }, '')
  }, [step, historyEnabled])

  return { step, setStep, direction }
}
