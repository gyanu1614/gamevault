import { describe, expect, it } from 'vitest'
import { dayKey, dayLabel } from './day-label'

describe('chat day dividers', () => {
  const now = new Date(2026, 9, 21, 15, 0) // Oct 21 2026, local time

  it('Today, Yesterday, then a short date (year only when it is not this year)', () => {
    expect(dayLabel(new Date(2026, 9, 21, 0, 5).toISOString(), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 9, 20, 23, 59).toISOString(), now)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 9, 3, 12).toISOString(), now)).toBe('Oct 3')
    expect(dayLabel(new Date(2025, 11, 30, 12).toISOString(), now)).toBe('Dec 30, 2025')
  })

  it('groups by the local calendar day', () => {
    expect(dayKey(new Date(2026, 9, 21, 0, 1).toISOString())).toBe(dayKey(new Date(2026, 9, 21, 23, 59).toISOString()))
    expect(dayKey(new Date(2026, 9, 21, 0, 1).toISOString())).not.toBe(dayKey(new Date(2026, 9, 20, 23, 59).toISOString()))
  })
})
