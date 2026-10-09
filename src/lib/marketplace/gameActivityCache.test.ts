import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The footer renders on every page. Its activity read used to page up to 30k
 * order + listing rows to the server just to count them per game; the counts
 * now come from ONE aggregate RPC returning a row per game.
 */
const calls = vi.hoisted(() => ({ rpc: [] as unknown[][], from: [] as string[] }))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    rpc: (fn: string, args: unknown) => {
      calls.rpc.push([fn, args])
      return Promise.resolve({
        data: [
          { game_id: 'g-am', orders_30d: 12, active_listings: 40 },
          { game_id: 'g-sab', orders_30d: 0, active_listings: 7 },
        ],
        error: null,
      })
    },
    from: (table: string) => {
      calls.from.push(table)
      const q: any = {
        select: () => q,
        eq: () => q,
        not: () => q,
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: [{ id: 'g-am', trend_peak_playing: 900 }], error: null }),
      }
      return q
    },
  }),
}))
vi.mock('@/lib/seo/public-hygiene', () => ({ getTestSellerIds: vi.fn(async () => ['t1']) }))

import { readGameActivity } from './gameActivityCache'

beforeEach(() => {
  calls.rpc.length = 0
  calls.from.length = 0
})

describe('readGameActivity', () => {
  it('counts per game in one aggregate RPC — no orders / listings rows paged', async () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const out = await readGameActivity(now, ['seller-test'])
    expect(calls.rpc).toEqual([
      [
        'footer_game_activity',
        {
          p_since: '2026-09-09T12:00:00.000Z',
          p_statuses: ['paid', 'delivering', 'delivered', 'disputed', 'completed'],
          p_exclude_sellers: ['seller-test'],
        },
      ],
    ])
    expect(calls.from).toEqual(['games'])
    expect(out).toEqual({
      orders30d: { 'g-am': 12 },
      activeListings: { 'g-am': 40, 'g-sab': 7 },
      trendPeak: { 'g-am': 900 },
    })
  })
})
