/**
 * Step 7a — the category page prerenders the pairs the sitemap advertises:
 * (game, category) with at least one active non-test listing, plus curated
 * currency categories (a game with an admin currency config is indexable
 * before its first listing). Same rule as src/app/sitemap.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '@/test/fakes/supabase-recorder'

let recorder: SupabaseRecorder
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => recorder.client }))

import { getIndexableCategoryPairs, getAllEnabledCategoryPairs } from './category-pairs'

// Reads reach React.cache / unstable_cache through seller presence; pass them through.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}))

describe('getIndexableCategoryPairs', () => {
  it('follows the sitemap rule: enabled categories with a buyable listing or curated content, sorted', async () => {
    recorder = createSupabaseRecorder({
      games: [
        { id: 'g1', slug: 'roblox' },
        { id: 'g2', slug: 'valorant' },
        { id: 'g3', slug: 'fortnite' },
      ],
      game_categories: [
        { id: 'c1', slug: 'buy-items', type: 'items', game_id: 'g1' },
        { id: 'c2', slug: 'buy-robux', type: 'currency', game_id: 'g1' },
        { id: 'c3', slug: 'buy-accounts', type: 'account', game_id: 'g3' },
        { id: 'c4', slug: 'buy-vp', type: 'currency', game_id: 'g2' },
      ],
      category_configs: [
        // g1 curated, g2 only the default row (empty lists)
        { game_id: 'g1', config: { faq: [{}], steps: [] }, updated_at: '2026-09-20T00:00:00Z' },
        { game_id: 'g2', config: { faq: [], steps: [] }, updated_at: '2026-09-20T00:00:00Z' },
      ],
      listings: [
        { game_id: 'g1', game_category_id: 'c1', seller_id: 's1', price: 5, updated_at: '2026-09-28T00:00:00Z' },
        // free listing: not buyable, so fortnite/buy-accounts is not indexable
        { game_id: 'g3', game_category_id: 'c3', seller_id: 's1', price: 0, updated_at: '2026-09-28T00:00:00Z' },
        // a listing in a category that is not an enabled category of its game: never counts
        { game_id: 'g2', game_category_id: 'cX', seller_id: 's1', price: 5, updated_at: '2026-09-28T00:00:00Z' },
      ],
      seller_presence: [],
    })
    await expect(getIndexableCategoryPairs()).resolves.toEqual([
      { gameSlug: 'roblox', categorySlug: 'buy-items' },
      { gameSlug: 'roblox', categorySlug: 'buy-robux' },
    ])
  })

  it('returns an empty list rather than throwing when a read fails', async () => {
    recorder = createSupabaseRecorder()
    recorder.client.from = () => {
      throw new Error('db down')
    }
    await expect(getIndexableCategoryPairs()).resolves.toEqual([])
  })
})

/**
 * Step 7b — the category page prerenders EVERY enabled (active game, enabled
 * category) pair, not just the sitemap's set: with ~12 deploys/day, anything
 * not prerendered re-renders on first visit after each deploy.
 */
describe('getAllEnabledCategoryPairs', () => {
  it('lists every enabled category of every active game from one read, sorted', async () => {
    recorder = createSupabaseRecorder({
      game_categories: [
        { slug: 'buy-items', game: { slug: 'roblox', is_active: true } },
        { slug: 'buy-robux', game: { slug: 'roblox', is_active: true } },
        { slug: 'buy-items', game: { slug: 'dead-game', is_active: false } },
        { slug: 'buy-items', game: null },
        { slug: 'buy-accounts', game: { slug: 'fortnite', is_active: true } },
      ],
    })
    await expect(getAllEnabledCategoryPairs()).resolves.toEqual([
      { gameSlug: 'fortnite', categorySlug: 'buy-accounts' },
      { gameSlug: 'roblox', categorySlug: 'buy-items' },
      { gameSlug: 'roblox', categorySlug: 'buy-robux' },
    ])
    expect(recorder.tables()).toEqual(['game_categories'])
  })

  it('returns [] when the read fails (long tail then renders on demand)', async () => {
    recorder = createSupabaseRecorder()
    recorder.client.from = () => {
      throw new Error('db down')
    }
    await expect(getAllEnabledCategoryPairs()).resolves.toEqual([])
  })
})
