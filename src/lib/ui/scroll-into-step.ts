/**
 * Multi-step forms that swap their content in place (the /founding checklist:
 * one open step at a time, then the welcome screen) leave the window where the
 * button was, so the next step opens off-screen (owner, 2026-10-14). After a
 * step change, bring the step's start into view under the fixed navbar.
 */

/** Where to scroll so an element starts `offset` px below the top, or null when it already starts on screen. */
export function stepScrollTop({ rectTop, scrollY, offset }: { rectTop: number; scrollY: number; offset: number }): number | null {
  if (rectTop >= offset) return null
  return Math.max(0, Math.round(scrollY + rectTop - offset))
}

/** Scrolls `el` into view by the rule above (instantly under reduced motion). */
export function scrollToStep(el: HTMLElement | null, offset = 88): void {
  if (!el || typeof window === 'undefined') return
  const top = stepScrollTop({ rectTop: el.getBoundingClientRect().top, scrollY: window.scrollY, offset })
  if (top == null) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
}
