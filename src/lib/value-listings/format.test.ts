import { describe, it, expect } from 'vitest'
import { formatUsd } from './format'

describe('formatUsd', () => {
  it('keeps cents and drops .00', () => {
    expect(formatUsd(0.62)).toBe('$0.62')
    expect(formatUsd(4.5)).toBe('$4.50')
    expect(formatUsd(75)).toBe('$75')
    expect(formatUsd(223.53)).toBe('$223.53')
    expect(formatUsd(0.01)).toBe('$0.01')
  })
})
