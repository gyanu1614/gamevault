import { loadCoreRows } from '@/lib/seo/category-data'
import { fetchAllRows } from '@/lib/seo/paged-read'
import { getAllPosts, getFlatPosts } from '@/lib/blog/posts'
import { LANDING_PAGES } from '@/lib/seo/landingPages'
import { isLandingPageIndexable } from '@/lib/seo/landingPageInventory'

import { readGateConfig, REPORT_ONLY } from '@/lib/seo/gate/settings'

import type { SitemapInput, ValueEvidenceRow } from '@/lib/seo/sitemap-builder'

type Db = any

/**
 * The value-page gate inputs. FAILS OPEN: if the evidence cannot be read the
 * sitemap behaves as in report mode (nothing hidden), never as "no evidence".
 */
async function loadValueGate(db: Db): Promise<SitemapInput['valueGate']> {
  try {
    const [config, rows] = await Promise.all([
      readGateConfig(db),
      fetchAllRows<{ game_slug: string; item_slug: string; observations: number; history_days: number; value_usd: number | string | null; price_moved_at: string | null; is_protected: boolean; first_seen_at: string | null }>(
        (from, to) =>
          db
            .from('seo_value_evidence')
            .select('game_slug, item_slug, observations, history_days, value_usd, price_moved_at, is_protected, first_seen_at')
            .order('game_slug')
            .order('item_slug')
            .range(from, to),
      ),
    ])
    const evidence = new Map<string, ValueEvidenceRow>(
      rows.map((r) => [
        `${r.game_slug}/${r.item_slug}`,
        {
          observations: r.observations,
          historyDays: r.history_days,
          valueUsd: r.value_usd == null ? null : Number(r.value_usd),
          priceMovedAt: r.price_moved_at,
          isProtected: r.is_protected,
          firstSeenAt: r.first_seen_at ?? null,
        },
      ]),
    )
    return { mode: config.mode, overrides: config.overrides, evidence }
  } catch (e) {
    console.error('[sitemap] value gate read failed, listing as report mode:', e)
    return { mode: REPORT_ONLY.mode, overrides: REPORT_ONLY.overrides, evidence: new Map() }
  }
}

/** Everything buildSitemap needs, read through `db` (the anon client: the sitemap is static). */
export async function loadSitemapInput(db: Db, baseUrl: string): Promise<SitemapInput> {
  const [core, sab, adoptMe, pipeline, events, gamePosts, landingChecks, valueGate] =
    await Promise.all([
      loadCoreRows(db),
      fetchAllRows<SitemapInput['sabBrainrots'][number]>((from, to) =>
        db.from('sab_brainrot_catalog').select('slug, updated_at').order('slug').range(from, to),
      ),
      // Only PUBLISHABLE pets (has_page): a pet without a description 404s.
      fetchAllRows<SitemapInput['adoptMePets'][number]>((from, to) =>
        db.from('adopt_me_pets').select('slug, updated_at').eq('has_page', true).order('slug').range(from, to),
      ),
      fetchAllRows<{
        slug: string
        rarity: string | null
        games: { slug: string } | null
        values_prices: { price_changed_at: string | null; sample_size: number | null } | null
      }>((from, to) =>
        db
          .from('values_items')
          .select('id, slug, rarity, games!inner(slug), values_prices!inner(price_changed_at, sample_size)')
          .eq('is_enabled', true)
          .eq('is_priced', true)
          .order('id')
          .range(from, to),
      ),
      // The events archive (values_events): published rows, any game.
      fetchAllRows<{
        slug: string
        status: string
        items: unknown
        updated_at: string | null
        games: { slug: string } | null
      }>((from, to) =>
        db
          .from('values_events')
          .select('slug, status, items, updated_at, games!inner(slug)')
          .eq('is_published', true)
          .order('slug')
          .range(from, to),
      ),
      fetchAllRows<SitemapInput['gamePosts'][number]>((from, to) =>
        db
          .from('blog_posts')
          .select('slug, primary_game_slug, updated_at')
          .eq('status', 'published')
          .not('primary_game_slug', 'is', null)
          .order('slug')
          .range(from, to),
      ),
      Promise.all(LANDING_PAGES.map((page) => isLandingPageIndexable(page))),
      loadValueGate(db),
    ])

  return {
    baseUrl,
    ...core,
    sabBrainrots: sab,
    adoptMePets: adoptMe,
    pipelineItems: pipeline
      .filter((r) => r.games?.slug)
      .map((r) => ({
        gameSlug: r.games!.slug,
        slug: r.slug,
        rarity: r.rarity ?? null,
        priceChangedAt: r.values_prices?.price_changed_at ?? null,
        sampleSize: r.values_prices?.sample_size ?? null,
      })),
    valueEvents: events
      .filter((r) => r.games?.slug)
      .map((r) => ({
        gameSlug: r.games!.slug,
        slug: r.slug,
        status: r.status,
        itemCount: Array.isArray(r.items) ? r.items.length : 0,
        updatedAt: r.updated_at ?? null,
      })),
    gamePosts,
    posts: getAllPosts(),
    flatPosts: getFlatPosts(),
    landingSlugs: LANDING_PAGES.filter((_, i) => landingChecks[i]).map((p) => p.slug),
    valueGate,
  }
}
