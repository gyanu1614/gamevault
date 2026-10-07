/**
 * Cache tags for the shared reads every category page makes (Step 7b).
 *
 * These reads are identical across all ~600 prerendered pairs, so they are
 * `unstable_cache`d — fetched once per build instead of once per page — and
 * live on at runtime under these tags. The event that changes the data
 * revalidates the tag; the nightly full revalidate is the safety net.
 */

/** seller_presence rows with store_paused = true (hides those sellers' offers). */
export const PAUSED_SELLERS_TAG = 'seller-presence:paused'

/** profiles with is_test = true (hidden from every public surface). */
export const TEST_SELLERS_TAG = 'profiles:test-sellers'

/** The active games + enabled categories directory (footer mesh, sub-nav). */
export const GAME_DIRECTORY_TAG = 'games:directory'

/**
 * fee_rules / platform_fee_settings / seller_tier_config — every seller
 * commission rate quoted on a public surface (/sell/fees, the /[game]/sell
 * headline). The admin fee action revalidates it after every write
 * (fee-engine.md §4.2, §5.5); the pages' 24 h `revalidate` is the backstop.
 */
export const FEE_RULES_TAG = 'fees:rules'

/**
 * payment_method_fees / currency_rates — the buyer processing-fee terms
 * quoted on /fees (checkout B3). The admin buyer-fee action revalidates it
 * after every write; the page's 24 h `revalidate` is the backstop.
 */
export const BUYER_FEES_TAG = 'fees:buyer-methods'

/**
 * A game's hero background (games.hero_bg_*), read by GameHeroBackdrop on
 * every page of that game. The admin hero upload / reposition / remove
 * revalidates it, which refreshes every prerendered page of that one game
 * and nothing else.
 */
export function gameHeroTag(gameSlug: string): string {
  return `game-hero:${gameSlug}`
}

/**
 * The homepage's listing rails (Latest Listings, the game cards' live counts
 * and from-prices). Every listing read there is cached under this tag
 * (lib/listings/read-client.ts); revalidateListingSurfaces revalidates it
 * with the category tags, so a listing change refreshes the homepage — that
 * one page — and the nightly backstop refreshes it too.
 */
export const HOME_LISTINGS_TAG = 'listings:home'

/** Every game's admin CTA banner (lib/content/game-cta-art.server). */
export const GAME_CTA_BANNERS_TAG = 'games:cta-banners'
