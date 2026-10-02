import { describe, it, expect, vi, afterEach } from 'vitest'
import { isStaleBuildError, reloadOnceForStaleBuild } from './stale-build'

const g = globalThis as any

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

afterEach(() => {
  delete g.window
})

const missingModule = Object.assign(new TypeError("Cannot read properties of undefined (reading 'call')"), {
  stack: "TypeError: Cannot read properties of undefined (reading 'call')\n    at d (app:///_next/static/chunks/webpack-8c08a7e6583be028.js:1:152)",
})

describe('isStaleBuildError', () => {
  it('matches a missing module factory inside webpack', () => {
    expect(isStaleBuildError(missingModule)).toBe(true)
  })

  it("matches Safari's wording of the same thing", () => {
    const e = Object.assign(new TypeError("undefined is not an object (evaluating 'e[t].call')"), {
      stack: 'd@https://dropmarket.gg/_next/static/chunks/webpack-1.js:1:152',
    })
    expect(isStaleBuildError(e)).toBe(true)
  })

  it('matches chunk load failures', () => {
    expect(isStaleBuildError(Object.assign(new Error('Loading chunk 4223 failed.'), { name: 'ChunkLoadError' }))).toBe(true)
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: /x.js'))).toBe(true)
  })

  it("ignores an ordinary 'call' bug in app code", () => {
    const e = Object.assign(new TypeError("Cannot read properties of undefined (reading 'call')"), {
      stack: 'at onClick (app:///_next/static/chunks/app/shop/page-1.js:1:10)',
    })
    expect(isStaleBuildError(e)).toBe(false)
    expect(isStaleBuildError(new Error('Something else'))).toBe(false)
  })
})

describe('reloadOnceForStaleBuild', () => {
  it('reloads once, then lets the error show if it comes back within a minute', () => {
    g.window = { sessionStorage: memoryStorage() }
    const reload = vi.fn()
    expect(reloadOnceForStaleBuild(missingModule, reload, 1_000_000)).toBe(true)
    expect(reloadOnceForStaleBuild(missingModule, reload, 1_030_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    // A later stale error (next deploy) may reload again.
    expect(reloadOnceForStaleBuild(missingModule, reload, 1_100_000)).toBe(true)
  })

  it('never reloads when it cannot record the attempt (no storage → no loop)', () => {
    g.window = { sessionStorage: null }
    const reload = vi.fn()
    expect(reloadOnceForStaleBuild(missingModule, reload, 1_000_000)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does nothing for other errors', () => {
    g.window = { sessionStorage: memoryStorage() }
    const reload = vi.fn()
    expect(reloadOnceForStaleBuild(new Error('boom'), reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
