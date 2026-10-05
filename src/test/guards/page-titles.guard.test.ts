/**
 * Page titles never repeat the brand (Bundle 1, task 6).
 *
 * The root layout appends `| DropMarket` to every page title
 * (`title.template`), so a page must hand it a BARE title. Pages that also
 * wrote `| DropMarket` themselves rendered `... | DropMarket | DropMarket`
 * (Adopt Me values hub, /support, home). The fix is at the source: the page
 * string is bare, or `{ absolute }` when the brand already leads the title.
 *
 * Two checks:
 *  1. Runtime: each public route type renders its real metadata, the layout
 *     template is applied, and the final <title> carries the brand at most once.
 *  2. Static: no title literal in any of the 77 metadata files ends in the
 *     brand (catches admin/account/DB-backed routes the runtime table skips).
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import type { Metadata } from 'next'

import { ADMIN_TITLE_TEMPLATE, TITLE_TEMPLATE, brandMarkCount, resolveTitle } from '@/lib/seo/title'
import { createSupabaseRecorder } from '../fakes/supabase-recorder'

// Importing a page module also loads its JSX. Vitest transforms it with the
// classic runtime, while Next compiles pages for the automatic one, so give
// the modules the `React` they would otherwise import implicitly.
vi.stubGlobal('React', React)

// Public pages read through React.cache / unstable_cache, which need Next's
// runtime; pass the readers straight through (same as the other route tests).
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}))

// DB-backed routes read through the recording fake (rows are returned as seeded,
// filters are not evaluated): just enough data for each page to reach its title.
const GAME = {
  id: 'g1', name: 'Valorant', slug: 'valorant', is_active: true, content_tier: 'full',
  seo_indexable: null, ecosystem: null, description: null, image_url: null, icon_url: null,
  seo_title: null, seo_description: null, seo_h1: null, seo_intro: null,
}
const CATEGORY = {
  id: 'c1', name: 'Valorant Points', slug: 'buy-vp', type: 'currency', is_enabled: true,
  game_id: 'g1', game: { slug: 'valorant', name: 'Valorant' }, extras: {},
}
// Currency listings have no page of their own (they 308 to the currency page),
// so the listing-page title check runs on an ITEM listing.
const ITEM_CATEGORY = {
  id: 'c2', name: 'Valorant Items', slug: 'buy-items', type: 'items', is_enabled: true,
  game_id: 'g1', game: { slug: 'valorant', name: 'Valorant' }, extras: {},
}
const ITEM_LISTING = {
  id: 'l2', slug: 'valorant-knife-skin', title: 'Knife Skin', description: 'Fast delivery', price: 19.99,
  status: 'active', quantity: 1, game_id: 'g1', game_category_id: 'c2', image_url: null,
  game: { slug: 'valorant', name: 'Valorant' }, category: { slug: 'buy-items', name: 'Valorant Items', type: 'items' },
  seller: { id: 's1', username: 'seller1', is_test: false },
}
const LISTING = {
  id: 'l1', slug: 'valorant-1000-vp', title: '1000 VP', description: 'Fast delivery', price: 9.99,
  status: 'active', quantity: 5, game_id: 'g1', game_category_id: 'c1', image_url: null,
  game: { slug: 'valorant', name: 'Valorant' }, category: { slug: 'buy-vp', name: 'Valorant Points' },
  seller: { id: 's1', username: 'seller1', is_test: false },
}
const SEED: Record<string, any[]> = {
  games: [{ ...GAME, categories: [CATEGORY, ITEM_CATEGORY] }],
  // The recorder ignores filters and returns the FIRST row, so the item rows
  // lead: the listing page must resolve to an item listing, not a currency one.
  game_categories: [ITEM_CATEGORY, CATEGORY],
  listings: [ITEM_LISTING, LISTING],
  category_configs: [],
  adopt_me_pets: [{ slug: 'bat-dragon', name: 'Bat Dragon', has_page: true, image_url: null }],
  public_profiles: [],
  seller_presence: [],
}
const recorder = createSupabaseRecorder(SEED)
recorder.client.rpc = async () => ({ data: null, error: null })
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => recorder.client }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => recorder.client }))

// Each route test imports the REAL page module (and its component tree) on first
// use: ~1-3 s normally, 5-10 s on a loaded machine. Vitest's 5 s default is too tight.
const SLOW_IMPORT_MS = 60_000

// A thenable that is also the plain object: works for `await params` (Next 15
// shape) and `params.slug` (Next 14 shape).
const params = <T extends object>(p: T) => Object.assign(Promise.resolve(p), p)

type MetaModule = {
  metadata?: Metadata
  generateMetadata?: (props: any, parent: any) => Promise<Metadata> | Metadata
}

async function metadataOf(mod: MetaModule, p: object = {}): Promise<Metadata> {
  if (mod.generateMetadata) {
    return mod.generateMetadata({ params: params(p), searchParams: params({}) }, Promise.resolve({}))
  }
  if (mod.metadata) return mod.metadata
  throw new Error('route exports no metadata')
}

interface Route {
  name: string
  load: () => Promise<MetaModule>
  params?: object
  template?: string
}

const ROUTES: Route[] = [
  { name: 'home', load: () => import('@/app/page') },
  { name: 'support', load: () => import('@/app/support/page') },
  { name: 'early-seller', load: () => import('@/app/early-seller/page') },
  { name: 'signup-become-seller', load: () => import('@/app/signup-become-seller/page') },
  { name: 'browse', load: () => import('@/app/browse/page') },
  { name: 'seller fees', load: () => import('@/app/(marketing)/sell/fees/page') },
  { name: 'safedrop', load: () => import('@/app/(marketing)/safedrop/page') },
  { name: 'global blog hub', load: () => import('@/app/blog/page') },
  { name: 'values hub (adopt-me)', load: () => import('@/app/(marketplace)/[gameSlug]/values/page'), params: { gameSlug: 'adopt-me' } },
  { name: 'values hub (steal-an-egg)', load: () => import('@/app/(marketplace)/[gameSlug]/values/page'), params: { gameSlug: 'steal-an-egg' } },
  { name: 'methodology (adopt-me)', load: () => import('@/app/(marketplace)/[gameSlug]/values/methodology/page'), params: { gameSlug: 'adopt-me' } },
  { name: 'methodology (steal-an-egg)', load: () => import('@/app/(marketplace)/[gameSlug]/values/methodology/page'), params: { gameSlug: 'steal-an-egg' } },
  { name: 'calculator (adopt-me)', load: () => import('@/app/(marketplace)/[gameSlug]/calculator/page'), params: { gameSlug: 'adopt-me' } },
  { name: 'neon calculator (adopt-me)', load: () => import('@/app/(marketplace)/[gameSlug]/neon-calculator/page'), params: { gameSlug: 'adopt-me' } },
  { name: 'price index (steal-a-brainrot)', load: () => import('@/app/(marketplace)/[gameSlug]/price-index/page'), params: { gameSlug: 'steal-a-brainrot' } },
  { name: 'admin overview', load: () => import('@/app/(admin)/admin/(overview)/page'), template: ADMIN_TITLE_TEMPLATE },
  // DB-backed (recording fake above)
  { name: 'game hub', load: () => import('@/app/(marketplace)/[gameSlug]/page'), params: { gameSlug: 'valorant' } },
  { name: 'game sell page', load: () => import('@/app/(marketplace)/[gameSlug]/sell/page'), params: { gameSlug: 'valorant' } },
  { name: 'category page', load: () => import('@/app/(marketplace)/[gameSlug]/[categorySlug]/page'), params: { gameSlug: 'valorant', categorySlug: 'buy-vp' } },
  { name: 'listing page', load: () => import('@/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/page'), params: { gameSlug: 'valorant', categorySlug: 'buy-items', listingSlug: 'valorant-knife-skin' } },
  { name: 'value item (adopt-me)', load: () => import('@/app/(marketplace)/[gameSlug]/values/[itemSlug]/page'), params: { gameSlug: 'adopt-me', itemSlug: 'bat-dragon' } },
]

// Every legal document page: the title comes from the document registry.
const LEGAL_DIR = path.join(process.cwd(), 'src/app/(legal)')
for (const dir of readdirSync(LEGAL_DIR)) {
  if (!statSync(path.join(LEGAL_DIR, dir)).isDirectory()) continue
  ROUTES.push({
    name: `legal /${dir}`,
    load: () => import(/* @vite-ignore */ `@/app/(legal)/${dir}/page`),
  })
}

describe('final <title> repeats the brand at most once (every route type)', () => {
  it.each(ROUTES.map((r) => [r.name, r] as const))('%s', async (_name, route) => {
    const meta = await metadataOf(await route.load(), route.params)
    const title = resolveTitle(meta.title, route.template ?? TITLE_TEMPLATE)
    if (title === null) return // no title of its own: the layout default applies
    // The seeded rows must carry each page to its real title, not its 404 title.
    expect(title, `${route.name} fell through to a not-found title`).not.toMatch(/not found/i)
    const marks = brandMarkCount(title)
    expect(marks, `"${title}" carries the brand ${marks} times`).toBeLessThanOrEqual(1)
  }, SLOW_IMPORT_MS)
})

describe('Adopt Me value item page: bare tab title, branded social title', () => {
  it('renders the brand once in the tab and keeps the OG title branded as before', async () => {
    const mod = await import('@/app/(marketplace)/[gameSlug]/values/[itemSlug]/page')
    const meta = await metadataOf(mod, { gameSlug: 'adopt-me', itemSlug: 'bat-dragon' })
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const bare = `Bat Dragon Value in Adopt Me (${monthYear}) — Cash & Trade Value`

    expect(meta.title).toBe(bare) // the page hands the layout a bare title
    expect(resolveTitle(meta.title, TITLE_TEMPLATE)).toBe(`${bare} | DropMarket`)
    expect(meta.openGraph?.title).toBe(`${bare} | DropMarket`) // social title unchanged
  }, SLOW_IMPORT_MS)
})

describe('a title typed into the admin (data, not code) cannot double the brand either', () => {
  it('game hub: games.seo_title that already ends in the brand', async () => {
    const original = SEED.games
    SEED.games = [{ ...GAME, seo_title: 'Buy Valorant Points Fast | DropMarket', categories: [CATEGORY] }]
    try {
      const mod = await import('@/app/(marketplace)/[gameSlug]/page')
      const meta = await metadataOf(mod, { gameSlug: 'valorant' })
      const tab = resolveTitle(meta.title, TITLE_TEMPLATE)
      expect(tab).toBe('Buy Valorant Points Fast | DropMarket')
      // ...while the social title keeps the string exactly as the editor wrote it.
      expect(meta.openGraph?.title).toBe('Buy Valorant Points Fast | DropMarket')
    } finally {
      SEED.games = original
    }
  }, SLOW_IMPORT_MS)
})

// ---------------------------------------------------------------------------
// Static scan of every file that exports metadata.
// ---------------------------------------------------------------------------

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/^(page|layout)\.tsx$/.test(entry)) yield full
  }
}

// A `title:` literal ending in `| DropMarket`. openGraph/twitter titles are not
// templated and none of them use a `|` suffix (they use "—" or no brand), so a
// match anywhere in a file is a page title that doubles the brand.
const BRAND_SUFFIXED_TITLE = /\btitle:\s*[`'"][^`'"\n]*\|\s*DropMarket(?: Admin)?[`'"]/
const BRAND_SUFFIXED_CONST = /const title = `[^`\n]*\|\s*DropMarket`/

describe('no metadata file hands the layout a title that already ends in the brand', () => {
  const root = path.join(process.cwd(), 'src/app')
  const files = [...walk(root)].filter((f) => /export (async )?function generateMetadata|export const metadata/.test(readFileSync(f, 'utf8')))

  it('scans every metadata-exporting page and layout', () => {
    expect(files.length).toBeGreaterThanOrEqual(70)
  })

  it.each(files.map((f) => [path.relative(root, f), f] as const))('%s', (rel, file) => {
    const src = readFileSync(file, 'utf8')
    const doubled = BRAND_SUFFIXED_TITLE.test(src) || BRAND_SUFFIXED_CONST.test(src)
    expect(doubled, `${rel} writes the brand into its own title; the layout template adds it`).toBe(false)
  })
})
