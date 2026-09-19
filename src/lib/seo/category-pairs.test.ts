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

import { getIndexableCategoryPairs } from './category-pairs'

describe('getIndexableCategoryPairs', () => {
  it('unions listing pairs with curated currency categories, deduped and sorted', async () => {
    recorder = createSupabaseRecorder({
      listings: [
        { game: { slug: 'roblox' }, category: { slug: 'buy-items' } },
        { game: { slug: 'roblox' }, category: { slug: 'buy-items' } },
        { game: { slug: 'fortnite' }, category: { slug: 'buy-accounts' } },
        { game: null, category: { slug: 'orphan' } },
      ],
      category_configs: [{ game_id: 'g1' }],
      game_categories: [
        { slug: 'buy-robux', game_id: 'g1', game: { slug: 'roblox' } },
        { slug: 'buy-vp', game_id: 'g2', game: { slug: 'valorant' } },
      ],
    })
    await expect(getIndexableCategoryPairs()).resolves.toEqual([
      { gameSlug: 'fortnite', categorySlug: 'buy-accounts' },
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
