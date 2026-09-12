/**
 * Guard fixtures create real auth users and rows. They must only ever run
 * against a local Supabase stack unless ALLOW_REMOTE_GUARD_TESTS=1 is set
 * explicitly — a suite run with .env.local unshadowed leaked a fixture into
 * production on 2026-09-12.
 */
import { describe, it, expect } from 'vitest'
import { assertGuardTargetAllowed } from './throwaway'

describe('guard fixtures refuse a non-local Supabase URL', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321'])('allows %s', (u) => {
    expect(() => assertGuardTargetAllowed(u, {})).not.toThrow()
  })
  it.each(['https://cserfvabcdefgh.supabase.co', 'https://db.dropmarket.gg', 'http://10.0.0.5:54321'])('refuses %s', (u) => {
    expect(() => assertGuardTargetAllowed(u, {})).toThrow(/ALLOW_REMOTE_GUARD_TESTS/)
  })
  it('refuses when the URL is missing', () => {
    expect(() => assertGuardTargetAllowed(undefined, {})).toThrow()
  })
  it('allows a remote URL only with ALLOW_REMOTE_GUARD_TESTS=1', () => {
    expect(() => assertGuardTargetAllowed('https://cserfvabcdefgh.supabase.co', { ALLOW_REMOTE_GUARD_TESTS: '1' })).not.toThrow()
    expect(() => assertGuardTargetAllowed('https://cserfvabcdefgh.supabase.co', { ALLOW_REMOTE_GUARD_TESTS: 'true' })).toThrow()
  })
})
