/**
 * The values-health reads against the real schema (local stack): every table
 * and column the daily check names exists, so a rename fails here instead of
 * turning the morning check into a false "could not read" alert. Read-only.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from './throwaway'
import { readGameHealth, VALUES_HEALTH_GAMES } from '@/lib/values/health'
import { loadAdminValues } from '@/lib/values/admin-values'

let svc: SupabaseClient

describe.skipIf(!hasEnv)('values health reads (guard)', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
  })
  for (const game of VALUES_HEALTH_GAMES) {
    it(`${game.gameSlug}: every read works`, async () => {
      const input = await readGameHealth(svc, game)
      expect(input.readError).toBeUndefined()
      expect(typeof input.listCount).toBe('number')
    })
  }
})

describe.skipIf(!hasEnv)('admin Values tab reads (guard)', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
  })
  for (const game of VALUES_HEALTH_GAMES) {
    it(`${game.gameSlug}: loads rows, counts and runs`, async () => {
      const page = await loadAdminValues(svc, game.gameSlug, { view: 'all', q: '', page: 1 })
      expect(page.summary.total).toBeGreaterThanOrEqual(page.rows.length)
      expect(Array.isArray(page.runs)).toBe(true)
    })
  }
})
