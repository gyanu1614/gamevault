'use client'

import { useEffect, useState } from 'react'

/**
 * Height of the on-screen keyboard on phones, from the Visual Viewport API.
 *
 * iOS Safari (and Android Chrome by default) do not shrink the layout
 * viewport when the keyboard opens: a `fixed bottom-0` sheet stays where it
 * was and the keyboard slides over it. Lift the sheet by this inset so it
 * rides on top of the keyboard, and cap its height at `viewportHeight`.
 *
 * Returns zeros while `active` is false, on sm+ (where dialogs are centred,
 * not bottom sheets) and when the gap is small enough to be browser chrome
 * (toolbar show/hide) rather than a keyboard.
 */
export function useKeyboardInset(active: boolean): { inset: number; viewportHeight: number } {
  const [state, setState] = useState({ inset: 0, viewportHeight: 0 })

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) {
      setState({ inset: 0, viewportHeight: 0 })
      return
    }
    const phone = window.matchMedia('(max-width: 639px)')
    const update = () => {
      if (!phone.matches) return setState({ inset: 0, viewportHeight: 0 })
      const gap = window.innerHeight - vv.height - vv.offsetTop
      setState(gap > 120 ? { inset: Math.round(gap), viewportHeight: Math.round(vv.height) } : { inset: 0, viewportHeight: 0 })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return state
}
