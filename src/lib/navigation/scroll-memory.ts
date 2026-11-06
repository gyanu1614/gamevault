/**
 * Where the visitor was on each page, so Back lands there and not at the top. Held in
 * memory only, for the last few pages: a number each, gone when the tab closes.
 */
const MAX_PAGES = 30
const positions = new Map<string, number>()

export function rememberScroll(page: string, y: number): void {
  positions.delete(page)
  positions.set(page, y)
  if (positions.size > MAX_PAGES) positions.delete(positions.keys().next().value as string)
}

export const recallScroll = (page: string): number | null => positions.get(page) ?? null

/**
 * Scrolls there, trying for a few frames: the page can still be growing (filters coming
 * back from the address, a later page of results).
 */
export function holdScroll(y: number, frames = 30): void {
  endHoldTop?.()
  window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
  if (Math.abs(window.scrollY - y) > 1 && frames > 0) requestAnimationFrame(() => holdScroll(y, frames - 1))
}

const HOLD_TOP_MS = 800
const HAND_ON_PAGE = ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const
let endHoldTop: (() => void) | null = null

/**
 * Puts a new page at the top and keeps it there while it settles (owner, 2026-11-06: on a
 * phone, Buy Now opened checkout part way down). iPhone Safari animates page scrolls under
 * `scroll-behavior: smooth`, and the new page arriving can cut one short, so one scroll
 * isn't enough. Smooth scrolling is off while it holds. A hand on the page ends it: from
 * then on the page is theirs.
 */
export function holdTop(ms = HOLD_TOP_MS): void {
  endHoldTop?.()
  const root = document.documentElement
  const smooth = root.style.scrollBehavior
  root.style.scrollBehavior = 'auto'
  const until = performance.now() + ms

  const end = () => {
    endHoldTop = null
    root.style.scrollBehavior = smooth
    for (const type of HAND_ON_PAGE) window.removeEventListener(type, end)
  }
  endHoldTop = end
  for (const type of HAND_ON_PAGE) window.addEventListener(type, end, { passive: true })

  const toTop = () => {
    if (endHoldTop !== end) return
    window.scrollTo(0, 0)
    root.scrollTop = 0
    document.body.scrollTop = 0
    if (performance.now() < until) requestAnimationFrame(toTop)
    else end()
  }
  toTop()
}

let awaitedPop: Event | null = null
let handledPop: Event | null = null

/** From a popstate listener. */
export function notePop(event: Event): void {
  if (event !== handledPop) awaitedPop = event
}

/** A link was clicked: the Back before it is over. */
export function forgetPop(): void {
  awaitedPop = null
}

/**
 * Whether the page being drawn came from Back or Forward. Our listener can't settle it
 * alone: React draws a Back inside the browser's popstate event, straight after Next's
 * listener, and ours starts later than Next's (2026-11-06, seen in Chrome: the page drew
 * first, then our listener ran). So the event in progress counts too. When React draws
 * later, the event is over and the listener has already run.
 */
export function wasHistoryMove(): boolean {
  const current = window.event
  if (current?.type === 'popstate') {
    handledPop = current
    awaitedPop = null
    return true
  }
  const waiting = awaitedPop !== null
  awaitedPop = null
  return waiting
}

let pagesBehind = 0

/** One move inside the site. A forward step counts as a back step, which only ever sends Back to its safe link. */
export function noteSiteMove(viaHistory: boolean): void {
  pagesBehind = viaHistory ? Math.max(0, pagesBehind - 1) : pagesBehind + 1
}

/** A page of ours is behind this one, so the back arrow can really go back and keep its search and filters. */
export const hasSitePageBehind = (): boolean => pagesBehind > 0
