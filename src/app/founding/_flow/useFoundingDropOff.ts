'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics/client'
import { createFoundingExit, type FoundingExitState } from '@/lib/analytics/founding-drop-off'

/**
 * Reports `founding_left` when someone leaves /founding before their store is
 * open. Closing the tab or going to another site fires pagehide and no React
 * cleanup; a link inside the app runs the cleanup and no pagehide. Both report,
 * and the tracker keeps it to one event.
 */
export function useFoundingDropOff(stage: number, signedIn: boolean): void {
  const latest = useRef<FoundingExitState>({ step: stage, signedIn, finished: stage >= 5 })
  useEffect(() => {
    latest.current = { step: stage, signedIn, finished: stage >= 5 }
  }, [stage, signedIn])

  useEffect(() => {
    const exit = createFoundingExit(
      () => latest.current,
      (props) => track('founding_left', props, { beacon: true }),
    )
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) exit.returned()
    }
    window.addEventListener('pagehide', exit.left)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pagehide', exit.left)
      window.removeEventListener('pageshow', onShow)
      exit.left()
    }
  }, [])
}
