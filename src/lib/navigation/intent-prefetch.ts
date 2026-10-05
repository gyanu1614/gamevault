/**
 * Prefetch a link on INTENT, never because it scrolled into view.
 *
 * next/link prefetches every link that enters the viewport. On a page with a
 * 100-link footer that is a hundred `?_rsc=` requests per view, and Google was
 * spending 26% of its crawl on them. AppLink therefore switches Next's own
 * prefetching off and marks the anchor with INTENT_ATTR; this listener, bound
 * once for the whole document, prefetches only when a person shows interest:
 *   - mouse resting on the link for HOVER_DELAY_MS (a sweep across the footer
 *     prefetches nothing, a deliberate hover does),
 *   - a finger touching it (touchstart fires ~100 ms before the click),
 *   - keyboard focus.
 * Navigation stays fast for real visitors; crawlers, which never hover, touch or
 * tab, trigger none. Pure of React and Next: the caller supplies `prefetch`.
 */
export const INTENT_ATTR = 'data-intent-prefetch'
export const HOVER_DELAY_MS = 65

export interface IntentAnchor {
  getAttribute(name: string): string | null
}

export interface IntentOptions {
  /** Prefetch one same-origin path (the app router's `router.prefetch`). */
  prefetch: (href: string) => void
  hoverDelayMs?: number
  /** True when the visitor asked the browser to save data. */
  saveData?: () => boolean
}

/** Same-origin, in-app, opens in this tab, is not a download: otherwise null. */
function prefetchableHref(anchor: IntentAnchor): string | null {
  const href = anchor.getAttribute('href')
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null
  if (anchor.getAttribute('target') === '_blank') return null
  if (anchor.getAttribute('download') !== null) return null
  return href
}

export function createIntentPrefetcher(opts: IntentOptions) {
  const delay = opts.hoverDelayMs ?? HOVER_DELAY_MS
  const done = new Set<string>()
  let pending: { anchor: IntentAnchor; timer: ReturnType<typeof setTimeout> } | null = null

  const run = (anchor: IntentAnchor) => {
    if (opts.saveData?.()) return
    const href = prefetchableHref(anchor)
    if (!href || done.has(href)) return
    done.add(href)
    opts.prefetch(href)
  }
  const cancel = () => {
    if (pending) clearTimeout(pending.timer)
    pending = null
  }

  return {
    hover(anchor: IntentAnchor) {
      if (pending?.anchor === anchor) return
      cancel()
      pending = {
        anchor,
        timer: setTimeout(() => {
          pending = null
          run(anchor)
        }, delay),
      }
    },
    leave(anchor: IntentAnchor) {
      if (pending?.anchor === anchor) cancel()
    },
    touch: run,
    focus: run,
  }
}

type Listener = (event: any) => void
export interface EventRoot {
  addEventListener(name: string, fn: Listener, opts?: { passive?: boolean }): void
  removeEventListener(name: string, fn: Listener): void
}

const closestMarked = (target: unknown): IntentAnchor | null =>
  (target as { closest?: (sel: string) => IntentAnchor | null } | null)?.closest?.(`a[${INTENT_ATTR}]`) ?? null

/** Bind the listeners on `root` (the document). Returns an unbind function. */
export function bindIntentPrefetch(root: EventRoot, opts: IntentOptions): () => void {
  const p = createIntentPrefetcher(opts)
  const handlers: Record<string, Listener> = {
    mouseover: (e) => {
      const a = closestMarked(e.target)
      if (a) p.hover(a)
    },
    mouseout: (e) => {
      const a = closestMarked(e.target)
      // Moving between children of the same <a> (icon -> label) is not leaving it.
      if (a && closestMarked(e.relatedTarget) !== a) p.leave(a)
    },
    touchstart: (e) => {
      const a = closestMarked(e.target)
      if (a) p.touch(a)
    },
    focusin: (e) => {
      const a = closestMarked(e.target)
      if (a) p.focus(a)
    },
  }
  for (const [name, fn] of Object.entries(handlers)) root.addEventListener(name, fn, { passive: true })
  return () => {
    for (const [name, fn] of Object.entries(handlers)) root.removeEventListener(name, fn)
  }
}
