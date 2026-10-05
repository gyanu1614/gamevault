/**
 * The runner's reprice → publish pass (scripts/reprice.mjs is the CLI).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/pricing/games/sab', () => ({ runSabCorrection: vi.fn() }))
vi.mock('@/lib/pricing/games/adopt-me', () => ({ runAdoptMeCorrection: vi.fn() }))
vi.mock('@/lib/pricing/games/steal-an-egg', () => ({ runStealAnEggCorrection: vi.fn() }))

import { repriceAndPublish } from './run'
import type { PricingGame } from './registry'
import type { RevalidateRequest } from './publish'

function fakeClient(snapshot: Array<{ item_slug: string; variant: string; prices: Record<string, number> }>) {
  const upserts: unknown[] = []
  const client = {
    from: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        order: () => b,
        range: async () => ({ data: snapshot, error: null }),
        upsert: async (rows: unknown[]) => {
          upserts.push(...rows)
          return { error: null }
        },
        delete: () => b,
        then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r),
      }
      return b
    },
  }
  return { client, upserts }
}

const game = (prices = [{ itemSlug: 'owl', variant: 'FR', prices: { average: 70 } }]): PricingGame => ({
  key: 'adopt-me',
  gameSlug: 'adopt-me',
  run: vi.fn(async () => ({ priced: 1, publishedPrices: prices })),
})

const silent = () => {}

describe('repriceAndPublish', () => {
  it('publish=changed: revalidates only moved items and keeps publishedPrices out of the log summary', async () => {
    const { client } = fakeClient([{ item_slug: 'owl', variant: 'FR', prices: { average: 60 } }])
    const calls: RevalidateRequest[] = []
    const out = await repriceAndPublish(game(), {
      publish: 'changed',
      client,
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    expect(calls).toEqual([{ gameSlug: 'adopt-me', changedSlugs: ['owl'] }])
    expect(out).not.toHaveProperty('publishedPrices')
    expect((out.publish as { changed_count: number }).changed_count).toBe(1)
  })

  it('publish=off: reprices without touching the cache or the snapshot', async () => {
    const revalidate = vi.fn()
    const g = game()
    const out = await repriceAndPublish(g, { publish: 'off', revalidate, log: silent })
    expect(g.run).toHaveBeenCalledTimes(1)
    expect(revalidate).not.toHaveBeenCalled()
    expect(out.publish).toEqual({ mode: 'off' })
  })

  it('publish=full: asks for the whole game and resets the baseline to what pages now show', async () => {
    const { client, upserts } = fakeClient([])
    const calls: RevalidateRequest[] = []
    await repriceAndPublish(game(), {
      publish: 'full',
      client,
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    expect(calls).toEqual([{ gameSlug: 'adopt-me', full: true }])
    expect(upserts).toHaveLength(1)
  })

  it('refuses to publish without the route config — before spending the reprice', async () => {
    const g = game()
    await expect(
      repriceAndPublish(g, { publish: 'changed', env: {}, log: silent }),
    ).rejects.toThrow('PUBLIC_API_URL and VALUES_REVALIDATE_SECRET')
    expect(g.run).not.toHaveBeenCalled()
  })

  it('reads the per-game change rule (env override applies)', async () => {
    const { client } = fakeClient([{ item_slug: 'owl', variant: 'FR', prices: { average: 60 } }])
    const calls: RevalidateRequest[] = []
    await repriceAndPublish(game(), {
      publish: 'changed',
      client,
      env: { PRICE_CHANGE_MIN_RELATIVE: '0.5' },
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    // 60 → 70 is +16.7%: under a 50% rule nothing is published.
    expect(calls).toEqual([{ gameSlug: 'adopt-me', changedSlugs: [] }])
  })
})
