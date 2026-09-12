/**
 * ROUTE-001 — the unauthenticated diagnostic page /test-connection must not
 * exist. It rendered Supabase env-var presence, an anon-key prefix and raw
 * per-table probe errors to any visitor; robots.txt only hid it from crawlers.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('ROUTE-001 — /test-connection is gone', () => {
  it('has no route directory', () => {
    expect(existsSync('src/app/test-connection')).toBe(false)
  })
  it('is no longer referenced by robots.ts (nothing left to hide)', () => {
    expect(readFileSync('src/app/robots.ts', 'utf8')).not.toMatch(/test-connection/)
  })
})
