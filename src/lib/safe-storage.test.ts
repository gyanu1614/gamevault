import { describe, it, expect, afterEach } from 'vitest'
import { safeSession } from './safe-storage'

const g = globalThis as any

afterEach(() => {
  delete g.window
})

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe('safeSession', () => {
  it('reads, writes and removes through sessionStorage when it exists', () => {
    g.window = { sessionStorage: memoryStorage() }
    safeSession.set('a', '1')
    expect(safeSession.get('a')).toBe('1')
    safeSession.remove('a')
    expect(safeSession.get('a')).toBeNull()
  })

  it('degrades when the webview exposes sessionStorage as null', () => {
    g.window = { sessionStorage: null }
    expect(() => safeSession.set('a', '1')).not.toThrow()
    expect(safeSession.get('a')).toBeNull()
    expect(() => safeSession.remove('a')).not.toThrow()
  })

  it('degrades when touching sessionStorage throws (blocked site data)', () => {
    g.window = {}
    Object.defineProperty(g.window, 'sessionStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
    expect(safeSession.get('a')).toBeNull()
    expect(() => safeSession.set('a', '1')).not.toThrow()
  })

  it('swallows a full quota on write', () => {
    g.window = {
      sessionStorage: {
        ...memoryStorage(),
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    }
    expect(() => safeSession.set('a', '1')).not.toThrow()
  })

  it('returns null on the server', () => {
    expect(safeSession.get('a')).toBeNull()
  })
})

describe('safeLocal', () => {
  it('reads and writes localStorage, and never throws when it is missing', async () => {
    const { safeLocal } = await import('./safe-storage')
    const mem = new Map<string, string>()
    const g = globalThis as unknown as { window?: unknown }
    const prev = g.window
    g.window = { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } }
    safeLocal.set('k', 'v')
    expect(safeLocal.get('k')).toBe('v')
    safeLocal.remove('k')
    expect(safeLocal.get('k')).toBeNull()
    g.window = { get localStorage(): Storage { throw new Error('blocked') } }
    expect(safeLocal.get('k')).toBeNull()
    expect(() => safeLocal.set('k', 'v')).not.toThrow()
    g.window = prev
  })
})
