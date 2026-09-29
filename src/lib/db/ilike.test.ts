import { describe, it, expect } from 'vitest'
import { ilikeContains } from './ilike'

describe('ilikeContains', () => {
  it('wraps plain text', () => {
    expect(ilikeContains('Robux')).toBe('%Robux%')
  })
  it('escapes %, _ and backslash', () => {
    expect(ilikeContains('50%')).toBe('%50\\%%')
    expect(ilikeContains('a_b')).toBe('%a\\_b%')
    expect(ilikeContains('c:\\x')).toBe('%c:\\\\x%')
  })
})
