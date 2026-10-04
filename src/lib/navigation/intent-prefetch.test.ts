import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { INTENT_ATTR, bindIntentPrefetch } from '@/lib/navigation/intent-prefetch'

/**
 * Link prefetching happens on INTENT only: a mouse resting on a link, a finger
 * touching it, or keyboard focus. Links that merely scroll into view are never
 * prefetched. Google followed every visible link's `?_rsc=` prefetch (26% of its
 * requests); real visitors keep fast navigation because intent still prefetches.
 */

type Handler = (event: any) => void

/** Minimal stand-in for `document`: stores listeners, lets a test fire events. */
function fakeRoot() {
  const listeners = new Map<string, Handler>()
  return {
    addEventListener: (name: string, fn: Handler) => void listeners.set(name, fn),
    removeEventListener: (name: string) => void listeners.delete(name),
    names: () => [...listeners.keys()].sort(),
    fire: (name: string, event: object) => listeners.get(name)?.(event),
  }
}

/** An element whose closest() resolves to `anchor` (or null when it is not inside one). */
function inside(anchor: object | null) {
  return { closest: (sel: string) => (sel.includes(INTENT_ATTR) ? anchor : null) }
}

function anchor(attrs: Record<string, string | null> = {}) {
  const all: Record<string, string | null> = { href: '/valorant/buy-vp', [INTENT_ATTR]: '', ...attrs }
  return { getAttribute: (name: string) => all[name] ?? null }
}

describe('intent prefetch', () => {
  let prefetch: ReturnType<typeof vi.fn>
  let root: ReturnType<typeof fakeRoot>
  let unbind: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    prefetch = vi.fn()
    root = fakeRoot()
    unbind = bindIntentPrefetch(root, { prefetch })
  })
  afterEach(() => {
    unbind()
    vi.useRealTimers()
  })

  describe('desktop: hover', () => {
    it('prefetches once the pointer has rested on the link', () => {
      const a = anchor()
      root.fire('mouseover', { target: inside(a) })
      vi.advanceTimersByTime(64)
      expect(prefetch).not.toHaveBeenCalled()
      vi.advanceTimersByTime(2)
      expect(prefetch).toHaveBeenCalledTimes(1)
      expect(prefetch).toHaveBeenCalledWith('/valorant/buy-vp')
    })

    it('does not prefetch when the pointer only sweeps across the link', () => {
      const a = anchor()
      root.fire('mouseover', { target: inside(a) })
      vi.advanceTimersByTime(30)
      root.fire('mouseout', { target: inside(a), relatedTarget: inside(null) })
      vi.advanceTimersByTime(500)
      expect(prefetch).not.toHaveBeenCalled()
    })

    it('keeps waiting while the pointer moves between children of the same link', () => {
      const a = anchor()
      root.fire('mouseover', { target: inside(a) })
      vi.advanceTimersByTime(30)
      root.fire('mouseout', { target: inside(a), relatedTarget: inside(a) }) // icon -> label, same <a>
      root.fire('mouseover', { target: inside(a) })
      vi.advanceTimersByTime(40)
      expect(prefetch).toHaveBeenCalledTimes(1)
    })

    it('prefetches a given URL only once, however often it is hovered', () => {
      const a = anchor()
      for (let i = 0; i < 3; i++) {
        root.fire('mouseover', { target: inside(a) })
        vi.advanceTimersByTime(100)
        root.fire('mouseout', { target: inside(a), relatedTarget: inside(null) })
      }
      expect(prefetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('mobile: touch', () => {
    it('prefetches immediately on touchstart, with no dwell', () => {
      root.fire('touchstart', { target: inside(anchor({ href: '/adopt-me/values' })) })
      expect(prefetch).toHaveBeenCalledTimes(1)
      expect(prefetch).toHaveBeenCalledWith('/adopt-me/values')
    })
  })

  describe('keyboard', () => {
    it('prefetches on focus', () => {
      root.fire('focusin', { target: inside(anchor({ href: '/browse' })) })
      expect(prefetch).toHaveBeenCalledWith('/browse')
    })
  })

  describe('never on scroll into view', () => {
    it('listens to pointer, touch and focus events only, never to scroll or visibility', () => {
      expect(root.names()).toEqual(['focusin', 'mouseout', 'mouseover', 'touchstart'])
    })

    it('does nothing at all with no user input, however long it waits', () => {
      vi.advanceTimersByTime(60_000)
      expect(prefetch).not.toHaveBeenCalled()
    })
  })

  describe('what is eligible', () => {
    it.each([
      ['an external URL', { href: 'https://example.com/x' }],
      ['a protocol-relative URL', { href: '//evil.example/x' }],
      ['an in-page anchor', { href: '#faq' }],
      ['a mailto link', { href: 'mailto:help@dropmarket.gg' }],
      ['a link that opens a new tab', { target: '_blank' }],
      ['a download', { download: '' }],
      ['an anchor with no href', { href: null }],
    ])('ignores %s', (_label, attrs) => {
      root.fire('touchstart', { target: inside(anchor(attrs)) })
      expect(prefetch).not.toHaveBeenCalled()
    })

    it('ignores links that did not opt in (no marker attribute)', () => {
      root.fire('touchstart', { target: inside(null) })
      expect(prefetch).not.toHaveBeenCalled()
    })

    it('respects Data Saver', () => {
      unbind()
      root = fakeRoot()
      unbind = bindIntentPrefetch(root, { prefetch, saveData: () => true })
      root.fire('touchstart', { target: inside(anchor()) })
      expect(prefetch).not.toHaveBeenCalled()
    })
  })

  it('unbinding removes every listener', () => {
    unbind()
    expect(root.names()).toEqual([])
    unbind = () => {}
  })
})
