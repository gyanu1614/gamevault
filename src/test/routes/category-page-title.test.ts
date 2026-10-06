/**
 * Category page titles: the layout template appends " | DropMarket", so an
 * admin `seo_title` that already ends with the brand must be used as an
 * absolute title, never branded twice ("… | DropMarket | DropMarket").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createSupabaseRecorder } from '../fakes/supabase-recorder'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used on a public read')
  },
}))

// vitest compiles the page's JSX with the classic runtime (React.createElement).
;(globalThis as { React?: typeof React }).React = React

const category = {
  id: 'c1', slug: 'buy-items', name: 'Items', type: 'items', is_enabled: true,
  seo_title: null as string | null, seo_description: null, description: null,
  game: { slug: 'adopt-me' },
}
let recorder = createSupabaseRecorder({})
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => recorder.client,
  // Listing reads go through the tagged client (lib/listings/read-client.ts).
  createTaggedAnonClient: () => recorder.client,
}))

async function titleFor(seoTitle: string | null) {
  category.seo_title = seoTitle
  recorder = createSupabaseRecorder({
    games: [{ id: 'g1', name: 'Adopt Me', slug: 'adopt-me', is_active: true }],
    game_categories: [category],
    category_configs: [],
    listings: [],
    profiles: [],
    public_profiles: [],
    seller_presence: [],
  })
  const { generateMetadata } = await import('@/app/(marketplace)/[gameSlug]/[categorySlug]/page')
  const meta = await generateMetadata({ params: Promise.resolve({ gameSlug: 'adopt-me', categorySlug: 'buy-items' }) } as never)
  return meta.title
}

describe('category page title', () => {
  beforeEach(() => vi.resetModules())

  it('an admin title that already ends with the brand is used as-is', async () => {
    expect(await titleFor('Buy Adopt Me Pets | DropMarket')).toEqual({ absolute: 'Buy Adopt Me Pets | DropMarket' })
    expect(await titleFor('Buy Adopt Me Pets - DropMarket')).toEqual({ absolute: 'Buy Adopt Me Pets - DropMarket' })
  })

  it('a bare admin title is left to the layout template', async () => {
    expect(await titleFor('Buy Adopt Me Pets')).toBe('Buy Adopt Me Pets')
  })

  it('the generated title never carries the brand itself', async () => {
    const title = await titleFor(null)
    expect(typeof title).toBe('string')
    expect(String(title)).not.toMatch(/dropmarket/i)
  })
})
