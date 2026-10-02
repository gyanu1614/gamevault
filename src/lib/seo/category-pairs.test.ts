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

import {
  getIndexableCategoryPairs,
  getAllEnabledCategoryPairs,
  onlyRenderablePairs,
} from './category-pairs'

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

/**
 * Found by the 2026-10-01 GSC index report: the sitemap advertised
 * /gta-vi/buy-items, which 404s. The pair came from an ACTIVE listing sitting
 * under a category whose game_categories.is_enabled is false; the page gate
 * (`_routeGate`) only serves enabled categories of active games. A sitemap URL
 * the page cannot serve is a contradictory signal, so the sitemap's pair set is
 * narrowed to what the page can render.
 */
describe('onlyRenderablePairs', () => {
  const renderable = [
    { gameSlug: 'gta-vi', categorySlug: 'buy-accounts' },
    { gameSlug: 'roblox', categorySlug: 'buy-items' },
    { gameSlug: 'valorant', categorySlug: 'buy-vp' },
  ]

  it('drops a pair the page would 404 on (listing under a disabled category)', () => {
    const keys = ['roblox/buy-items', 'gta-vi/buy-items', 'valorant/buy-vp']
    expect(onlyRenderablePairs(keys, renderable)).toEqual(['roblox/buy-items', 'valorant/buy-vp'])
  })

  it('keeps every renderable pair, in the order given', () => {
    const keys = new Set(['valorant/buy-vp', 'gta-vi/buy-accounts', 'roblox/buy-items'])
    expect(onlyRenderablePairs(keys, renderable)).toEqual([
      'valorant/buy-vp',
      'gta-vi/buy-accounts',
      'roblox/buy-items',
    ])
  })

  it('drops a pair of a game that is not active (absent from the renderable set)', () => {
    expect(onlyRenderablePairs(['dead-game/buy-items'], renderable)).toEqual([])
  })

  it('fails OPEN when the renderable set is empty — a failed read must not empty the sitemap', () => {
    expect(onlyRenderablePairs(['roblox/buy-items', 'gta-vi/buy-items'], [])).toEqual([
      'roblox/buy-items',
      'gta-vi/buy-items',
    ])
  })

  it('returns [] for no pairs', () => {
    expect(onlyRenderablePairs([], renderable)).toEqual([])
  })
})
