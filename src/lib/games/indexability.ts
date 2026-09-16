/**
 * Phase 1 · Step 1 — the single definition of when a game surface is
 * indexable.
 *
 * `/[gameSlug]/page.tsx` (robots meta) and `/sitemap.ts` (inclusion) MUST
 * agree: a page that says `noindex` while the sitemap advertises it is a
 * contradictory signal, and the two rules previously lived as duplicated
 * inline logic in both files with comments asking the reader to keep them in
 * sync by hand. They now import from here.
 *
 * Waved rollout (Step 1 decision): seeding ~200 `listed` games must NOT ship
 * ~200 thin, zero-inventory hubs to the index. A listed game earns its hub in
 * the index by having real inventory; until then the hub still renders 200
 * with useful content, and the *sell* page — which is genuinely useful with
 * zero inventory, because it is aimed at sellers — carries the SEO.
 */

/** Inputs for the hub rule. Kept primitive so both callers can build it. */
export interface GameHubIndexabilityInput {
  /** games.content_tier — `data` games carry a values/content hub. */
  contentTier: string | null | undefined
  /** Count of ACTIVE, non-test listings for this game. */
  activeListingCount: number
  /** True when the game has a curated currency category_configs row. */
  hasCuratedCurrencyConfig: boolean
  /** games.seo_indexable — explicit admin override; wins when not null. */
  seoIndexable?: boolean | null
}

/**
 * Hub `/[game]` — indexable when the game has something real to rank:
 * at least one active listing, OR it is a `data`-tier game (values hub
 * content exists independent of inventory), OR an admin has forced it.
 *
 * A curated currency config also counts: it predates content_tier and
 * marks a hub an admin deliberately built out before its first listing.
 */
export function isGameHubIndexable(input: GameHubIndexabilityInput): boolean {
  if (input.seoIndexable != null) return input.seoIndexable
  return (
    input.activeListingCount > 0 ||
    input.contentTier === 'data' ||
    input.hasCuratedCurrencyConfig
  )
}

/**
 * Sell page `/[game]/sell` — indexable for every active game with at least
 * one enabled category, inventory or not. The page targets sellers
 * ("sell X for real money"), so it is complete and useful with zero
 * listings; gating it on inventory would hide exactly the page meant to
 * solve the inventory problem.
 */
export function isGameSellPageIndexable(input: {
  enabledCategoryCount: number
  seoIndexable?: boolean | null
}): boolean {
  if (input.seoIndexable === false) return false
  return input.enabledCategoryCount > 0
}
