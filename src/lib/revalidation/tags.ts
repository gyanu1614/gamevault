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
