import { describe, it, expect } from 'vitest'
import { PROFILE_FRESH_MS, shouldReloadProfile } from './profile-reload'

const NOW = 1_000_000_000
const fresh = { userId: 'u1', at: NOW - 60_000 }

// 2026-10-20 usage audit (D/4.1): AuthProvider re-read profiles(*) and the
// seller application on EVERY auth event: INITIAL_SESSION right after initAuth
// had loaded it, SIGNED_IN on every tab switch / phone unlock (auth-js
// _recoverAndRefresh), and TOKEN_REFRESHED about hourly per tab.
describe('shouldReloadProfile', () => {
  it('skips the re-read for the same user loaded moments ago', () => {
    for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'] as const) {
      expect(shouldReloadProfile(event, 'u1', fresh, NOW), event).toBe(false)
    }
  })

  it('reloads once the loaded profile is older than the freshness window', () => {
    expect(shouldReloadProfile('SIGNED_IN', 'u1', { userId: 'u1', at: NOW - PROFILE_FRESH_MS - 1 }, NOW)).toBe(true)
  })

  it('always loads a different user, or when nothing is loaded yet', () => {
    expect(shouldReloadProfile('SIGNED_IN', 'u2', fresh, NOW)).toBe(true)
    expect(shouldReloadProfile('INITIAL_SESSION', 'u1', null, NOW)).toBe(true)
  })

  it('always reloads after the user record changed', () => {
    expect(shouldReloadProfile('USER_UPDATED', 'u1', fresh, NOW)).toBe(true)
  })
})
