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

// ── Category pages and value items (Bundle 1, task 4) ───────────────────────
// The same contract as the game rules above: the page's robots meta and the
// sitemap entry read ONE verdict, so a listed page can never say noindex and a
// page that 404s can never be listed (`/gta-vi/buy-items` was both).

/** Fewer live listings than this behind a value = not a ranking page (noindex). */
export const MIN_VALUE_SAMPLE_SIZE = 3

/** A value item page is a ranking page only with a price backed by enough live listings. */
export function isValueItemIndexable(input: {
  priced: boolean
  sampleSize: number | null | undefined
}): boolean {
  return input.priced && (input.sampleSize ?? 0) >= MIN_VALUE_SAMPLE_SIZE
}

/**
 * Admin-curated currency content (FAQ or steps) makes a currency category page
 * unique value before its first listing. A default config row with empty lists
 * is NOT curation: the admin wizard seeds one for every currency game.
 */
export function hasCuratedCurrencyContent(
  config: { faq?: unknown[] | null; steps?: unknown[] | null } | null | undefined,
): boolean {
  return !!config && ((config.faq?.length ?? 0) > 0 || (config.steps?.length ?? 0) > 0)
}

/**
 * Category page `/[game]/[category]` — indexable with at least one BUYABLE
 * listing (active, non-test seller, seller not paused, price above 0: exactly
 * what the page's own grid and stats show) or curated currency content.
 */
export function isCategoryPageIndexable(input: {
  buyableListingCount: number
  hasCuratedContent: boolean
}): boolean {
  return input.buyableListingCount > 0 || input.hasCuratedContent
}

export type CategoryPageVerdict = 'not-found' | 'noindex' | 'index'

/**
 * What a category page does: 404 unless the game is active and the category is
 * enabled AND belongs to that game; otherwise indexable or noindex per above.
 */
export function categoryPageVerdict(input: {
  gameActive: boolean
  categoryEnabled: boolean
  categoryBelongsToGame: boolean
  buyableListingCount: number
  hasCuratedContent: boolean
}): CategoryPageVerdict {
  if (!input.gameActive || !input.categoryEnabled || !input.categoryBelongsToGame) return 'not-found'
  return isCategoryPageIndexable(input) ? 'index' : 'noindex'
}

// ── The value-page data gate (growth point 28) ──────────────────────────────
// A value page ranks only when it carries enough of OUR data. The page's robots
// meta and the sitemap both call valuePageVerdict with the same inputs (the
// page reads its seo_value_evidence row, the sitemap reads them all), so a
// listed page can never say noindex. The evidence is refreshed after every
// price job (src/lib/seo/gate/refresh.ts).

/** Offers we track behind the price. Owner-approved 2026-10-09 from the real distribution. */
export const VALUE_GATE_MIN_OBSERVATIONS = 5
/** Days with a price in the item's history. */
export const VALUE_GATE_MIN_HISTORY_DAYS = 7

/** report: computed and shown on /admin/seo, changes no robots meta. enforce: failing pages are noindex. */
export type SeoGateMode = 'report' | 'enforce'

export interface ValueEvidenceInput {
  valueUsd: number | null
  observations: number
  historyDays: number
}

export function passesValueDataGate(e: ValueEvidenceInput): boolean {
  return (
    e.valueUsd != null &&
    e.observations >= VALUE_GATE_MIN_OBSERVATIONS &&
    e.historyDays >= VALUE_GATE_MIN_HISTORY_DAYS
  )
}

export interface ValuePageIndexInput {
  /** The page's rule before the gate (pipeline: isValueItemIndexable; SAB / Adopt Me: true). */
  legacyIndexable: boolean
  /** The page's seo_value_evidence row; null when it has none yet. */
  evidence: (ValueEvidenceInput & { isProtected: boolean }) | null
  mode: SeoGateMode
  /** The owner's explicit decision for this URL (seo_index_overrides). */
  override: 'index' | 'noindex' | null
}

export type ValuePageVerdictReason =
  | 'override'
  | 'legacy'
  | 'report-only'
  | 'passes'
  | 'protected'
  | 'fails-gate'
  | 'no-evidence'

/**
 * Index or not, and why. Order: the owner's decision; the old per-source rule
 * (a page that was noindex stays so); report mode changes nothing else; then the
 * gate, except that a page Google has indexed or that earned clicks is never
 * hidden automatically (it is flagged on /admin/seo for the owner instead).
 */
export function valuePageVerdict(input: ValuePageIndexInput): { index: boolean; reason: ValuePageVerdictReason } {
  if (input.override) return { index: input.override === 'index', reason: 'override' }
  if (!input.legacyIndexable) return { index: false, reason: 'legacy' }
  if (input.mode === 'report') return { index: true, reason: 'report-only' }
  if (!input.evidence) return { index: false, reason: 'no-evidence' }
  if (passesValueDataGate(input.evidence)) return { index: true, reason: 'passes' }
  if (input.evidence.isProtected) return { index: true, reason: 'protected' }
  return { index: false, reason: 'fails-gate' }
}
