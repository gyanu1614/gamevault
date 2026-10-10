/**
 * The sitemap only advertises category pages the route can serve.
 *
 * Found by the 2026-10-01 GSC index report: /gta-vi/buy-items was in the
 * sitemap and answered 404. The game was active and approved; its `buy-items`
 * category had `is_enabled = false`; and an ACTIVE listing still sat under it.
 * The sitemap builds its (game, category) pairs from active listings and never
 * looked at the category's own flag, while `/[gameSlug]/[categorySlug]`
 * (`_routeGate`) serves only enabled categories of active games.
 *
 * `onlyRenderablePairs` has unit tests in `src/lib/seo/category-pairs.test.ts`.
 * This file covers the CALLER — it runs the REAL `sitemap()` against the local
 * DB, with a real listing under a real category whose flag it flips, which is
 * the only way to prove the wiring (see sitemap-index-override.guard for the
 * same reasoning).
 *
 * Mutates one existing/created `game_categories.is_enabled`; afterAll writes it
 * back to true (the fixture only ever picks an enabled pair) before the
 * fixture's own cleanup removes everything it created.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

import { hasEnv, makeFixture, activateFixtureListing, type Fixture } from './throwaway'

// The sitemap reads through the server client, which resolves cookies. Give it
// a request scope that works outside Next's request lifecycle.
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], get: () => undefined, set: () => {} }),
}))
// Build-time marker with no Node resolution — stub so the real module graph loads.
vi.mock('server-only', () => ({}))
// `lib/supabase/server` wraps createClient in React.cache(), which only exists
// inside a render; pass the factory through so each call reads fresh data.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T,>(fn: T) => fn }
})

// The sitemap reads the paused-seller list (seller-presence), which goes through
// unstable_cache and needs Next's incremental cache; outside a request, read through.
vi.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}))

let fx: Fixture | null = null
let ready = false
let categoryId = ''
let pairPath = ''

async function sitemapPaths(): Promise<Set<string>> {
  // Fresh import each time: sitemap() reads live data and Next's module cache
  // would otherwise hold the first result.
  vi.resetModules()
  // Every section of the split sitemap (app/sitemaps/[file]/route.ts serves them).
  const mod = await import('@/lib/seo/sitemap-sections')
  const entries = [...(await mod.loadSitemapSections()).values()].flat()
  return new Set(entries.map((e) => e.url.replace(/^https?:\/\/[^/]+/, '')))
}

async function setEnabled(value: boolean) {
  const { error } = await fx!.svc.from('game_categories').update({ is_enabled: value }).eq('id', categoryId)
  if (error) throw new Error(`game_categories.is_enabled=${value}: ${error.message}`)
}

describe.skipIf(!hasEnv)('sitemap category pages match the route gate (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    const { data, error } = await fx.svc
      .from('listings')
      .select(
        'game_category_id, game:games!listings_game_id_fkey(slug, is_active), category:game_categories!listings_game_category_id_fkey(slug)',
      )
      .eq('id', fx.listingId)
      .single()
    if (error || !data) throw new Error(`fixture listing read: ${error?.message}`)
    const row = data as any
    categoryId = row.game_category_id
    pairPath = `/${row.game.slug}/${row.category.slug}`
    ready = Boolean(row.game.is_active)
  }, 120_000)

  afterAll(async () => {
    try {
      if (fx && categoryId) await setEnabled(true)
    } finally {
      await fx?.cleanup()
    }
  }, 120_000)

  it('baseline: an active listing under an ENABLED category puts its category page in the sitemap', async () => {
    expect(ready, 'fixture picked an inactive game — the pair could never be renderable').toBe(true)
    expect((await sitemapPaths()).has(pairPath)).toBe(true)
  }, 120_000)

  it('drops the category page once its category is switched off — the route answers 404 for it', async () => {
    await setEnabled(false)
    // The listing is still active: this is exactly the /gta-vi/buy-items state.
    expect((await sitemapPaths()).has(pairPath)).toBe(false)
  }, 120_000)

  it('advertises it again when the category is re-enabled', async () => {
    await setEnabled(true)
    expect((await sitemapPaths()).has(pairPath)).toBe(true)
  }, 120_000)
})
