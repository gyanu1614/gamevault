/**
 * Step 7a — the game OG image prerenders the game hubs the sitemap advertises
 * (lib/games/indexability's isGameHubIndexable, same inputs as sitemap.ts).
 */
import { describe, it, expect, vi } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '@/test/fakes/supabase-recorder'

let recorder: SupabaseRecorder
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => recorder.client }))

import { getIndexableGameSlugs, getActiveGameSlugs } from './indexable-games'

describe('getIndexableGameSlugs', () => {
  it('keeps games with a live listing, data-tier content, a curated currency config, or an admin override', async () => {
    recorder = createSupabaseRecorder({
      games: [
        { id: 'g1', slug: 'roblox', content_tier: 'listed', seo_indexable: null },
        { id: 'g2', slug: 'steal-a-brainrot', content_tier: 'data', seo_indexable: null },
        { id: 'g3', slug: 'valorant', content_tier: 'listed', seo_indexable: null },
        { id: 'g4', slug: 'forced', content_tier: 'listed', seo_indexable: true },
        { id: 'g5', slug: 'empty', content_tier: 'listed', seo_indexable: null },
        { id: 'g6', slug: 'hidden', content_tier: 'data', seo_indexable: false },
      ],
      listings: [{ game: { slug: 'roblox' } }],
      category_configs: [{ game_id: 'g3' }],
    })
    await expect(getIndexableGameSlugs()).resolves.toEqual([
      'forced',
      'roblox',
      'steal-a-brainrot',
      'valorant',
    ])
  })

  it('returns [] when the read fails', async () => {
    recorder = createSupabaseRecorder()
    recorder.client.from = () => {
      throw new Error('db down')
    }
    await expect(getIndexableGameSlugs()).resolves.toEqual([])
  })
})

/** Step 7b — the game OG image is built for EVERY active game at deploy. */
describe('getActiveGameSlugs', () => {
  it('lists every active game slug, sorted, from one read', async () => {
    recorder = createSupabaseRecorder({
      games: [{ slug: 'valorant' }, { slug: 'adopt-me' }, { slug: 'roblox' }],
    })
    await expect(getActiveGameSlugs()).resolves.toEqual(['adopt-me', 'roblox', 'valorant'])
    expect(recorder.tables()).toEqual(['games'])
  })
  it('returns [] when the read fails', async () => {
    recorder = createSupabaseRecorder()
    recorder.client.from = () => {
      throw new Error('db down')
    }
    await expect(getActiveGameSlugs()).resolves.toEqual([])
  })
})
