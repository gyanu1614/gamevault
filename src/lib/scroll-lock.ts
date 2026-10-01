/**
 * One shared page scroll lock, counted.
 *
 * Menus, sheets and full-screen pages each used to lock scrolling on their
 * own: save `body.style.overflow`, set 'hidden', restore the saved value on
 * close. When two of those overlapped and released in the wrong order, the
 * second one "restored" the first one's 'hidden' after it had already
 * unlocked — the page stayed frozen until a refresh.
 *
 * Here every holder takes a counted lock per element: the first holder saves
 * the original inline value and locks, the last one to release puts it back.
 * Release order no longer matters, and releasing twice is harmless.
 */

export type ScrollLockTarget = 'body' | 'html'

const holders: Record<ScrollLockTarget, number> = { body: 0, html: 0 }
const original: Record<ScrollLockTarget, string> = { body: '', html: '' }

const elementFor = (target: ScrollLockTarget) =>
  target === 'html' ? document.documentElement : document.body

/** Lock page scrolling; call the returned function to release this hold. */
export function lockScroll(target: ScrollLockTarget = 'body'): () => void {
  if (holders[target] === 0) {
    const el = elementFor(target)
    original[target] = el.style.overflow
    el.style.overflow = 'hidden'
  }
  holders[target] += 1

  let released = false
  return () => {
    if (released) return
    released = true
    holders[target] = Math.max(0, holders[target] - 1)
    if (holders[target] === 0) elementFor(target).style.overflow = original[target]
  }
}
