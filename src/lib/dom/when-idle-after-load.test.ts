import { describe, it, expect, vi } from 'vitest'

import { whenIdleAfterLoad } from '@/lib/dom/when-idle-after-load'

/** A `window` stand-in whose load / idle moments the test controls. */
function fakeWindow(readyState: 'loading' | 'complete', withIdleCallback = true) {
  const listeners: Record<string, (() => void)[]> = {}
  const idle: { cb: () => void; timeout?: number }[] = []
  const win = {
    document: { readyState },
    addEventListener: (name: string, fn: () => void) => void (listeners[name] ??= []).push(fn),
    removeEventListener: (name: string, fn: () => void) => {
      listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn)
    },
    ...(withIdleCallback
      ? {
          requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => (idle.push({ cb, timeout: opts?.timeout }), idle.length),
          cancelIdleCallback: (id: number) => void idle.splice(id - 1, 1, { cb: () => {} }),
        }
      : {}),
  }
  return {
    win,
    fireLoad: () => (listeners.load ?? []).slice().forEach((f) => f()),
    runIdle: () => idle.forEach((i) => i.cb()),
    idle,
    loadListeners: () => (listeners.load ?? []).length,
  }
}

describe('whenIdleAfterLoad: keeps non-critical widgets out of the first-load window', () => {
  it('waits for the load event, then for an idle moment', () => {
    const w = fakeWindow('loading')
    const cb = vi.fn()
    whenIdleAfterLoad(cb, w.win as any)
    expect(cb).not.toHaveBeenCalled()
    w.fireLoad()
    expect(cb).not.toHaveBeenCalled() // loaded, but the browser has not gone idle yet
    w.runIdle()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('goes straight to the idle wait when the page already loaded', () => {
    const w = fakeWindow('complete')
    const cb = vi.fn()
    whenIdleAfterLoad(cb, w.win as any)
    expect(w.loadListeners()).toBe(0)
    w.runIdle()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('caps the idle wait at one second so a busy page cannot delay it for long', () => {
    const w = fakeWindow('complete')
    whenIdleAfterLoad(vi.fn(), w.win as any)
    expect(w.idle[0].timeout).toBe(1000)
  })

  it('falls back to a short timer where requestIdleCallback is missing (Safari)', () => {
    vi.useFakeTimers()
    try {
      const w = fakeWindow('complete', false)
      const cb = vi.fn()
      whenIdleAfterLoad(cb, w.win as any)
      expect(cb).not.toHaveBeenCalled()
      vi.advanceTimersByTime(250)
      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('the returned cleanup cancels everything, so an unmounted page never runs it', () => {
    const w = fakeWindow('loading')
    const cb = vi.fn()
    const cancel = whenIdleAfterLoad(cb, w.win as any)
    cancel()
    expect(w.loadListeners()).toBe(0)
    w.fireLoad()
    w.runIdle()
    expect(cb).not.toHaveBeenCalled()
  })

  it('runs the callback at most once', () => {
    const w = fakeWindow('complete')
    const cb = vi.fn()
    whenIdleAfterLoad(cb, w.win as any)
    w.runIdle()
    w.runIdle()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
