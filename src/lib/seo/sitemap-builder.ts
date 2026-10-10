import type { MetadataRoute } from 'next'
import { VALUE_CATALOG_GAMES } from '@/lib/value-listings/catalogs'

import { CONTENT_HUB_GAME_SLUGS, getGameContentTheme } from '@/lib/content/theme'
import {
  isGameHubIndexable,
  isGameSellPageIndexable,
  isValueItemIndexable,
  valuePageVerdict,
  type SeoGateMode,
} from '@/lib/games/indexability'
import { LEGAL_DOCS } from '@/lib/legal/documents'
import { valueItemHasPage } from '@/lib/values/hub-config'
import { isEventIndexable } from '@/lib/values/events-model'
import { freeGuideLastmod } from '@/lib/values/free-guide'
import { allBoxes, boxesCheckedAt } from '@/lib/values/boxes'
import { computeCategoryPages } from '@/lib/seo/category-index'
import { SITE_PAGES_UPDATED, legalLastUpdatedIso } from '@/lib/seo/page-dates'

/**
 * The sitemap, as a pure function of already-fetched rows (the loader is
 * sitemap-data.ts). Three promises, each pinned by sitemap-builder.test.ts:
 *
 *  1. Only URLs that return 200, are indexable and canonicalise to themselves.
 *     Every page type uses the SAME verdict as the page's own robots meta
 *     (lib/games/indexability.ts), so the two cannot drift.
 *  2. Every entry carries a truthful lastmod: the real change date of the row or
 *     copy behind the page. Never `new Date()`: a field that always says "now"
 *     teaches Google to ignore it. An entry whose data has no date has none.
 *  3. URLs equal their canonical exactly, including the homepage (the bare
 *     origin, which is what next/metadata resolves "/" to).
 *
 * Sell pages stay (they earn traffic on Bing). The sitemap is SPLIT by section
 * (buildSitemapSections, served at /sitemaps/<section>.xml behind the
 * /sitemap.xml index) so Search Console reports an index rate per page type.
 *
 * Value item pages: listed only when valuePageVerdict (the data gate) says
 * index, and their lastmod is the last MATERIAL price move (seo_value_evidence
 * price_moved_at) — the same value the page prints as "Updated" and puts in its
 * JSON-LD dateModified.
 */
export interface SitemapInput {
  baseUrl: string
  /** Active games only. */
  games: { id: string; slug: string; content_tier: string | null; updated_at: string | null; seo_indexable: boolean | null }[]
  /** Enabled categories only. */
  categories: { id: string; slug: string; type: string | null; game_id: string }[]
  currencyConfigs: {
    game_id: string
    config: { faq?: unknown[] | null; steps?: unknown[] | null } | null
    updated_at: string | null
  }[]
  /** Active listings of non-test sellers. */
  listings: {
    slug: string | null
    updated_at: string | null
    game_id: string
    game_category_id: string
    seller_id: string
    price: number | string | null
  }[]
  pausedSellerIds: ReadonlySet<string>
  sabBrainrots: { slug: string; updated_at: string | null }[]
  adoptMePets: { slug: string; updated_at: string | null }[]
  pipelineItems: {
    gameSlug: string
    slug: string
    /** values_items.rarity — a value-list hub pages only its high tiers. */
    rarity?: string | null
    priceChangedAt: string | null
    sampleSize: number | null
  }[]
  /** Published events archive rows (values_events), any game. */
  valueEvents: { gameSlug: string; slug: string; status: string; itemCount: number; updatedAt: string | null }[]
  gamePosts: { slug: string; primary_game_slug: string; updated_at: string | null }[]
  /** Every blog post (for the index page's date). */
  posts: { publishedAt: string }[]
  /** Posts that still live at the flat /blog/{slug} URL. */
  flatPosts: { slug: string; publishedAt: string }[]
  /** Landing pages that have real inventory. */
  landingSlugs: string[]
  /** The value-page data gate: mode, owner overrides (by path) and evidence keyed `${game}/${item}`. */
  valueGate: {
    mode: SeoGateMode
    overrides: ReadonlyMap<string, 'index' | 'noindex'>
    evidence: ReadonlyMap<string, ValueEvidenceRow>
  }
}

export interface ValueEvidenceRow {
  observations: number
  historyDays: number
  valueUsd: number | null
  priceMovedAt: string | null
  isProtected: boolean
  firstSeenAt?: string | null
}

/** One sitemap file per section, so Search Console shows the index rate per page type. */
export type SitemapSection = 'static' | 'blog' | 'buy' | 'sell' | 'hubs' | `values-${string}`

/** The verdict a value item page's robots meta gives, for the sitemap. */
export function valueItemListed(input: SitemapInput, gameSlug: string, itemSlug: string, legacyIndexable: boolean): boolean {
  const { mode, overrides, evidence } = input.valueGate
  return valuePageVerdict({
    legacyIndexable,
    evidence: evidence.get(`${gameSlug}/${itemSlug}`) ?? null,
    mode,
    override: overrides.get(`/${gameSlug}/values/${itemSlug}`) ?? null,
  }).index
}

type Entry = MetadataRoute.Sitemap[number]

const newest = (...dates: (string | null | undefined)[]): string | null =>
  dates.reduce<string | null>((acc, d) => (d && (!acc || d > acc) ? d : acc), null)
const dated = (d: string | null | undefined) => (d ? { lastModified: d } : {})

/** Every section's entries. URLs are unique across sections. */
export function buildSitemapSections(input: SitemapInput): Map<SitemapSection, MetadataRoute.Sitemap> {
  const { baseUrl } = input
  const at = (path: string) => `${baseUrl}${path}`

  const gameById = new Map(input.games.map((g) => [g.id, g]))
  const categoryById = new Map(input.categories.map((c) => [c.id, c]))
  const curatedConfigGameIds = new Set(input.currencyConfigs.map((c) => c.game_id))

  // Listings whose detail page exists: the game is active and the category is an
  // enabled category OF THAT GAME (otherwise the route gate 404s).
  const liveListings = input.listings.filter((l) => {
    const cat = categoryById.get(l.game_category_id)
    return !!l.slug && gameById.has(l.game_id) && !!cat && cat.game_id === l.game_id
  })
  const buyable = (l: SitemapInput['listings'][number]) =>
    !input.pausedSellerIds.has(l.seller_id) && Number(l.price) > 0

  // Newest change per game, over every active listing (what the hub shows).
  const gameListingLastmod = new Map<string, string>()
  const gamesWithListings = new Set<string>()
  for (const l of input.listings) {
    gamesWithListings.add(l.game_id)
    const prev = gameListingLastmod.get(l.game_id) ?? null
    const next = newest(prev, l.updated_at)
    if (next) gameListingLastmod.set(l.game_id, next)
  }
  // Home and /browse show live listings: they change when a buyable one does.
  const marketLastmod = newest(...liveListings.filter(buyable).map((l) => l.updated_at))

  // ── static pages ──────────────────────────────────────────────────────────
  const staticPages: Entry[] = [
    { url: baseUrl, ...dated(marketLastmod), changeFrequency: 'daily', priority: 1 },
    { url: at('/browse'), ...dated(marketLastmod), changeFrequency: 'daily', priority: 0.9 },
    { url: at('/safedrop'), ...dated(SITE_PAGES_UPDATED.safedrop), changeFrequency: 'weekly', priority: 0.8 },
    { url: at('/sell/fees'), ...dated(SITE_PAGES_UPDATED.sellFees), changeFrequency: 'weekly', priority: 0.7 },
    // The public seller page (open signup, 4 steps). /early-seller and
    // /signup-become-seller redirect here; /account/become-seller stays noindex.
    { url: at('/founding'), ...dated(SITE_PAGES_UPDATED.founding), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // ── legal: one route per doc under src/app/(legal). `safedrop` is /safedrop-policy.
  const legalUpdated = legalLastUpdatedIso()
  const legalPages: Entry[] = LEGAL_DOCS.map((doc) => ({
    url: at(doc.slug === 'safedrop' ? '/safedrop-policy' : `/${doc.slug}`),
    ...dated(legalUpdated),
    changeFrequency: 'monthly' as const,
    priority: 0.3,
  }))

  // ── blog ──────────────────────────────────────────────────────────────────
  const newestPost = newest(...input.posts.map((p) => p.publishedAt))
  const blogPages: Entry[] = [
    { url: at('/blog'), ...dated(newestPost), changeFrequency: 'weekly', priority: 0.6 },
    ...input.flatPosts.map((p) => ({
      url: at(`/blog/${p.slug}`),
      ...dated(p.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
  const gameBlogLastmod = new Map<string, string>()
  const gameBlogPages: Entry[] = input.gamePosts.map((p) => {
    const next = newest(gameBlogLastmod.get(p.primary_game_slug), p.updated_at)
    if (next) gameBlogLastmod.set(p.primary_game_slug, next)
    return {
      url: at(`/${p.primary_game_slug}/blog/${p.slug}`),
      ...dated(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.55,
    }
  })
  const gameBlogIndexPages: Entry[] = [...new Set(input.gamePosts.map((p) => p.primary_game_slug))].map((g) => ({
    url: at(`/${g}/blog`),
    ...dated(gameBlogLastmod.get(g)),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // ── landing pages (curated copy; only the ones with inventory) ───────────
  const landingPages: Entry[] = input.landingSlugs.map((slug) => ({
    url: at(`/buy/${slug}`),
    ...dated(SITE_PAGES_UPDATED.landingPages),
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  // ── content hubs: values, calculator, methodology, price index, items ────
  // A value page's date is its last material price move (seo_value_evidence).
  const movedAt = (game: string, slug: string) => input.valueGate.evidence.get(`${game}/${slug}`)?.priceMovedAt ?? null
  const gameMovedAt = new Map<string, string>()
  for (const [key, e] of input.valueGate.evidence) {
    const game = key.slice(0, key.indexOf('/'))
    const next = newest(gameMovedAt.get(game), e.priceMovedAt)
    if (next) gameMovedAt.set(game, next)
  }
  // Hub pages print every item's price: their date is the newest move of any of
  // them (before the first evidence refresh, the catalogue's own dates).
  const valuesUpdated = (slug: string): string | null => {
    if (gameMovedAt.has(slug)) return gameMovedAt.get(slug)!
    if (slug === 'steal-a-brainrot') return newest(...input.sabBrainrots.map((i) => i.updated_at))
    if (slug === 'adopt-me') return newest(...input.adoptMePets.map((i) => i.updated_at))
    return newest(...input.pipelineItems.filter((i) => i.gameSlug === slug).map((i) => i.priceChangedAt))
  }
  const itemsByGame: Record<string, { slug: string; updated_at: string | null }[]> = {}
  // Steal a Brainrot and Adopt Me pages have no older rule: only the gate.
  for (const [game, rows] of [['steal-a-brainrot', input.sabBrainrots], ['adopt-me', input.adoptMePets]] as const) {
    for (const r of rows) {
      if (!valueItemListed(input, game, r.slug, true)) continue
      ;(itemsByGame[game] ??= []).push({ slug: r.slug, updated_at: movedAt(game, r.slug) })
    }
  }
  for (const i of input.pipelineItems) {
    // Same rules as the item page: it must exist (valueItemHasPage — a value-list
    // hub has pages for its high tiers only), then its robots meta: the old
    // thin-content floor (priced, enough live listings) and the data gate.
    if (!valueItemHasPage(i.gameSlug, { rarity: i.rarity ?? null, priced: true })) continue
    if (!valueItemListed(input, i.gameSlug, i.slug, isValueItemIndexable({ priced: true, sampleSize: i.sampleSize }))) continue
    ;(itemsByGame[i.gameSlug] ??= []).push({ slug: i.slug, updated_at: movedAt(i.gameSlug, i.slug) })
  }
  const valueItemPages = new Map<string, Entry[]>()
  const extraPathsByGame: Record<string, { path: string; priority: number }[]> = {
    'adopt-me': [{ path: 'neon-calculator', priority: 0.6 }],
  }

  const hubPages: Entry[] = CONTENT_HUB_GAME_SLUGS.flatMap((slug) => {
    const theme = getGameContentTheme(slug)
    const data = valuesUpdated(slug)
    const out: Entry[] = []
    if (theme.pages.values) out.push({ url: at(`/${slug}/values`), ...dated(data), changeFrequency: 'daily', priority: 0.85 })
    if (theme.pages.calculator) out.push({ url: at(`/${slug}/calculator`), ...dated(data), changeFrequency: 'weekly', priority: 0.8 })
    for (const extra of extraPathsByGame[slug] ?? []) {
      out.push({ url: at(`/${slug}/${extra.path}`), ...dated(data), changeFrequency: 'weekly', priority: extra.priority })
    }
    if (theme.pages.methodology) {
      out.push({ url: at(`/${slug}/values/methodology`), ...dated(SITE_PAGES_UPDATED.methodology), changeFrequency: 'monthly', priority: 0.5 })
    }
    if (theme.pages.priceIndex) out.push({ url: at(`/${slug}/price-index`), ...dated(data), changeFrequency: 'daily', priority: 0.7 })
    if (theme.pages.events) {
      // The events archive: the hub, then every event page the route serves
      // with an index verdict (isEventIndexable — same rule as its robots meta).
      // lastmod = the event row's own updated_at; the hub = the newest of them.
      const events = input.valueEvents.filter((e) => e.gameSlug === slug)
      if (events.length > 0) {
        out.push({ url: at(`/${slug}/events`), ...dated(newest(...events.map((e) => e.updatedAt))), changeFrequency: 'weekly', priority: 0.75 })
        for (const e of events) {
          if (!isEventIndexable(e)) continue
          out.push({ url: at(`/${slug}/events/${e.slug}`), ...dated(e.updatedAt), changeFrequency: 'weekly', priority: 0.65 })
        }
      }
    }
    // The Chroma hub: lastmod = the newest Chroma price move (its numbers are live prices).
    if (theme.pages.chromas) {
      const chromaPrices = input.pipelineItems.filter((i) => i.gameSlug === slug && i.rarity === 'Chroma')
      if (chromaPrices.length > 0) {
        out.push({ url: at(`/${slug}/chromas`), ...dated(newest(...chromaPrices.map((i) => i.priceChangedAt))), changeFrequency: 'daily', priority: 0.8 })
      }
    }
    // Box Odds: the hub + every box page (closed set from the build-time seed).
    // lastmod = the newest of the research's check date and the price moves
    // of the items the page shows (its numbers are live prices).
    if (theme.pages.boxes && allBoxes(slug).length > 0) {
      const checked = boxesCheckedAt(slug)
      const moved = new Map(input.pipelineItems.filter((i) => i.gameSlug === slug).map((i) => [i.slug, i.priceChangedAt]))
      const boxes = allBoxes(slug).map((b) => ({ b, last: newest(checked ? `${checked}T00:00:00Z` : null, ...b.items.map((i) => (i.slug ? moved.get(i.slug) : null))) }))
      out.push({ url: at(`/${slug}/boxes`), ...dated(newest(...boxes.map((x) => x.last))), changeFrequency: 'daily', priority: 0.8 })
      for (const { b, last } of boxes) {
        out.push({ url: at(`/${slug}/boxes/${b.slug}`), ...dated(last), changeFrequency: 'weekly', priority: b.inShop ? 0.7 : 0.6 })
      }
    }
    // Inventory Worth: lastmod = the newest price move of any item (it totals live prices).
    if (theme.pages.inventory && input.pipelineItems.some((i) => i.gameSlug === slug)) {
      out.push({ url: at(`/${slug}/inventory`), ...dated(data), changeFrequency: 'daily', priority: 0.8 })
    }
    // The honest guides: lastmod = the research's own check date (build-time seed).
    if (theme.pages.freeItems && freeGuideLastmod(slug)) {
      out.push({ url: at(`/${slug}/free-items`), ...dated(freeGuideLastmod(slug)), changeFrequency: 'weekly', priority: 0.75 })
    }
    if (theme.pages.codes && freeGuideLastmod(slug)) {
      out.push({ url: at(`/${slug}/codes`), ...dated(freeGuideLastmod(slug)), changeFrequency: 'weekly', priority: 0.75 })
    }
    const items: Entry[] = []
    for (const item of itemsByGame[slug] ?? []) {
      if (!item.slug) continue
      items.push({ url: at(`/${slug}/values/${item.slug}`), ...dated(item.updated_at), changeFrequency: 'daily', priority: 0.7 })
    }
    valueItemPages.set(slug, items)
    return out
  })

  // ── game hubs and sell pages ──────────────────────────────────────────────
  const gamePages: Entry[] = input.games
    .filter((g) =>
      isGameHubIndexable({
        contentTier: g.content_tier,
        activeListingCount: gamesWithListings.has(g.id) ? 1 : 0,
        hasCuratedCurrencyConfig: curatedConfigGameIds.has(g.id),
        seoIndexable: g.seo_indexable,
      }),
    )
    .map((g) => ({
      url: at(`/${g.slug}`),
      ...dated(newest(g.updated_at, gameListingLastmod.get(g.id))),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  const gamesWithCategories = new Set(input.categories.map((c) => c.game_id))
  const sellPages: Entry[] = input.games
    .filter((g) =>
      isGameSellPageIndexable({
        enabledCategoryCount: gamesWithCategories.has(g.id) ? 1 : 0,
        seoIndexable: g.seo_indexable,
      }),
    )
    .map((g) => ({
      url: at(`/${g.slug}/sell`),
      ...dated(g.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // ── category and listing pages ────────────────────────────────────────────
  const categoryPages: Entry[] = computeCategoryPages({
    games: input.games,
    categories: input.categories,
    currencyConfigs: input.currencyConfigs,
    listings: input.listings,
    pausedSellerIds: input.pausedSellerIds,
  })
    .filter((r) => r.verdict === 'index')
    .map((r) => ({
      url: at(`/${r.gameSlug}/${r.categorySlug}`),
      ...dated(r.lastmod),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }))

  // Listing pages are noindex (2026-10-06) and never listed here: the category
  // pages above carry the listings.
  const sections: [SitemapSection, Entry[]][] = [
    ['static', [...staticPages, ...legalPages]],
    ['blog', [...blogPages, ...gameBlogIndexPages, ...gameBlogPages]],
    ['buy', [...landingPages, ...categoryPages]],
    ['hubs', [...hubPages, ...gamePages]],
    ['sell', sellPages],
    ...[...valueItemPages].map(([game, entries]) => [`values-${game}` as SitemapSection, entries] as [SitemapSection, Entry[]]),
  ]
  // One entry per URL across all sections, first one wins.
  const seen = new Set<string>()
  const out = new Map<SitemapSection, MetadataRoute.Sitemap>()
  for (const [section, entries] of sections) {
    out.set(section, entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true))))
  }
  return out
}

/** Every section's entries as one list (sitemap verification, IndexNow diffs). */
export function buildSitemap(input: SitemapInput): MetadataRoute.Sitemap {
  return [...buildSitemapSections(input).values()].flat()
}

/** The section ids, in index order: one values section per game with value item pages. */
export function sitemapSectionIds(): SitemapSection[] {
  return ['static', 'hubs', 'buy', 'sell', 'blog', ...VALUE_CATALOG_GAMES.map((g) => `values-${g}` as SitemapSection)]
}
