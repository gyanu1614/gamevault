import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ keys: [] as unknown[][] }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  unstable_cache: () => async (...args: unknown[]) => {
    h.keys.push(args)
    return {}
  },
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))

import { ADMIN_OVERVIEW_CACHE_SECONDS, getAdminOverviewStats } from './overview-stats'

const key = async (at: string) => {
  await getAdminOverviewStats(new Date(at))
  return JSON.stringify(h.keys.at(-1))
}

describe('getAdminOverviewStats cache key', () => {
  beforeEach(() => {
    h.keys = []
  })

  it('is shared inside one cache window', async () => {
    expect(ADMIN_OVERVIEW_CACHE_SECONDS).toBe(60)
    expect(await key('2026-11-04T10:00:05Z')).toBe(await key('2026-11-04T10:00:55Z'))
  })

  it('changes with the window, so a stale entry is never served to the next visitor', async () => {
    expect(await key('2026-11-04T10:00:05Z')).not.toBe(await key('2026-11-04T10:01:05Z'))
    expect(await key('2026-11-04T10:00:05Z')).not.toBe(await key('2026-11-04T17:00:05Z'))
  })

  it('carries the day, so "today" never reads yesterday', async () => {
    expect(await key('2026-11-04T10:00:05Z')).toContain('2026-11-04')
  })
})
