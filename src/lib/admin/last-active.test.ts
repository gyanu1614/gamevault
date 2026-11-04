import { describe, it, expect } from 'vitest'
import { ADMIN_LAST_ACTIVE_WRITE_MS, shouldTouchAdminLastActive } from './last-active'

describe('admin last_active_at write throttle', () => {
  const now = Date.parse('2026-11-02T22:00:00Z')

  it('writes when never set or unreadable', () => {
    expect(shouldTouchAdminLastActive(null, now)).toBe(true)
    expect(shouldTouchAdminLastActive(undefined, now)).toBe(true)
    expect(shouldTouchAdminLastActive('not a date', now)).toBe(true)
  })

  it('skips the write while the stored value is fresh', () => {
    expect(shouldTouchAdminLastActive(new Date(now - 60_000).toISOString(), now)).toBe(false)
  })

  it('writes once it is older than the window', () => {
    expect(shouldTouchAdminLastActive(new Date(now - ADMIN_LAST_ACTIVE_WRITE_MS).toISOString(), now)).toBe(true)
  })
})
