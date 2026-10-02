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
