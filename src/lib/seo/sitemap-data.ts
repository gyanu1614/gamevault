import { loadCoreRows } from '@/lib/seo/category-data'
import { fetchAllRows } from '@/lib/seo/paged-read'
import { getAllPosts, getFlatPosts } from '@/lib/blog/posts'
import { LANDING_PAGES } from '@/lib/seo/landingPages'
import { isLandingPageIndexable } from '@/lib/seo/landingPageInventory'

import { readGateConfig, REPORT_ONLY } from '@/lib/seo/gate/settings'

import type { SitemapInput, ValueEvidenceRow } from '@/lib/seo/sitemap-builder'
import { isNewIndexable } from '@/lib/values/new-item'

/** The facts the Google rule needs per item: raw dates + whether a How To Get exists. */
type FreshRow = { released_at?: string | null; created_at?: string | null; release_year?: number | null; htg?: string | null }
const fresh = (r: FreshRow, now: number) =>
  isNewIndexable(
    { releasedAt: r.released_at ?? null, addedAt: r.created_at ?? null, hasHowToGet: r.htg != null, hasReleaseInfo: r.released_at != null || r.release_year != null },
    now,
  )

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
  const now = Date.now()
  const [core, sabRows, sabFacts, adoptMeRows, pipeline, events, gamePosts, landingChecks, valueGate] =
    await Promise.all([
      loadCoreRows(db),
      fetchAllRows<{ slug: string; updated_at: string | null }>((from, to) =>
        db.from('sab_brainrot_catalog').select('slug, updated_at').order('slug').range(from, to),
      ),
      // The public catalogue view has no dates: read them (and How To Get's presence) from the table.
      fetchAllRows<FreshRow & { slug: string }>((from, to) =>
        db.from('sab_brainrots').select('slug, released_at, created_at, htg:how_to_get->>status').order('slug').range(from, to),
      ),
      // Every ACTIVE pet has a page (2026-10-21); the value gate decides indexing.
      fetchAllRows<FreshRow & { slug: string; updated_at: string | null }>((from, to) =>
        db
          .from('adopt_me_pets')
          .select('slug, updated_at, released_at, created_at, htg:how_to_get->>status')
          .eq('is_active', true)
          .order('slug')
          .range(from, to),
      ),
      // Every enabled item has a page: the price row is optional (left join).
      fetchAllRows<
        FreshRow & {
          slug: string
          rarity: string | null
          games: { slug: string } | null
          values_prices: { price_changed_at: string | null; sample_size: number | null } | null
        }
      >((from, to) =>
        db
          .from('values_items')
          .select('id, slug, rarity, created_at, release_year, htg:how_to_get->>status, games!inner(slug), values_prices(price_changed_at, sample_size)')
          .eq('is_enabled', true)
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
          .select('slug, primary_game_slug, updated_at, post_type')
          .eq('status', 'published')
          .not('primary_game_slug', 'is', null)
          .order('slug')
          .range(from, to),
      ),
      Promise.all(LANDING_PAGES.map((page) => isLandingPageIndexable(page))),
      loadValueGate(db),
    ])

  const sabFactsBySlug = new Map(sabFacts.map((f) => [f.slug, f]))
  return {
    baseUrl,
    ...core,
    sabBrainrots: sabRows.map((r) => {
      const f = sabFactsBySlug.get(r.slug)
      return { slug: r.slug, updated_at: r.updated_at, newIndexable: f ? fresh(f, now) : false }
    }),
    adoptMePets: adoptMeRows.map((r) => ({ slug: r.slug, updated_at: r.updated_at, newIndexable: fresh(r, now) })),
    pipelineItems: pipeline
      .filter((r) => r.games?.slug)
      .map((r) => ({
        gameSlug: r.games!.slug,
        slug: r.slug,
        rarity: r.rarity ?? null,
        priceChangedAt: r.values_prices?.price_changed_at ?? null,
        sampleSize: r.values_prices?.sample_size ?? null,
        newIndexable: fresh(r, now),
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
