/**
 * Phase 1 · Step 1 — shared game identity validation.
 *
 * Extracted from saveGameIdentity() (admin-game-wizard.ts) so the admin
 * wizard and the bulk seed script (scripts/seed-games.mjs) enforce exactly
 * one set of rules. Adding a game is a config-level action now, so a row
 * that the seed accepts MUST be a row the wizard would have accepted.
 *
 * Pure and dependency-free on purpose: the seed script is a plain .mjs node
 * process with no Next.js runtime, so nothing here may import server-only
 * modules or touch supabase.
 */

/** Game slugs are single URL segments served from /[gameSlug]. */
export const GAME_SLUG_PATTERN = /^[a-z0-9-]+$/

/**
 * Top-level app routes that would shadow /[gameSlug]. A game slugged
 * `blog` or `cart` resolves to the static route and its hub becomes
 * unreachable, so these are rejected at validation time rather than
 * discovered as a dead page after a 200-game seed.
 *
 * Note: the 8 curated SEO landing pages live under /buy/[slug], NOT at the
 * top level, so they cannot collide with a game slug. `buy` itself is
 * reserved here, which is what actually protects them.
 */
export const RESERVED_GAME_SLUGS = new Set([
  // src/app top-level directories and files
  'account', 'api', 'auth', 'blog', 'browse', 'buy', 'cart', 'checkout',
  'dev', 'early-seller', 'forgot-password', 'founding', 'kyc', 'listings',
  'login', 'notifications', 'orders', 'purchases', 'reviews', 'shop',
  'signup', 'signup-become-seller', 'support', 'wallet', 'wishlist',
  'sell', 'seller', 'admin', 'test', 'test-connection',
  // (legal) group — all render at the top level
  'acceptable-use', 'aml', 'buyer-terms', 'chargebacks', 'company',
  'complaints', 'cookies', 'fees', 'ip', 'privacy', 'prohibited',
  'refunds', 'risk', 'safedrop-policy', 'seller-agreement', 'terms',
  'trust-safety',
  // (marketing) group
  'safedrop',
  // well-known / static assets
  'robots.txt', 'sitemap.xml', 'favicon.ico', 'icon', 'apple-icon',
  'opengraph-image', '_next', 'static', 'public',
])

/** games.ecosystem CHECK constraint (baseline schema). */
export const GAME_ECOSYSTEMS = [
  'roblox', 'pc', 'console', 'mobile', 'mmo', 'sports', 'other',
] as const
export type GameEcosystem = (typeof GAME_ECOSYSTEMS)[number]

/** games.content_tier — `data` games carry a values/content hub. */
export const GAME_CONTENT_TIERS = ['listed', 'data'] as const
export type GameContentTier = (typeof GAME_CONTENT_TIERS)[number]

/** Global category slugs a game may enable (global_categories.slug). */
export const GAME_CATEGORY_SLUGS = [
  'currency', 'items', 'accounts', 'top-up', 'boosting',
] as const
export type GameCategorySlug = (typeof GAME_CATEGORY_SLUGS)[number]

export interface GameIdentityInput {
  name?: string | null
  slug?: string | null
  ecosystem?: string | null
  content_tier?: string | null
  categories?: string[] | null
}

export interface ValidatedGameIdentity {
  name: string
  slug: string
  ecosystem: GameEcosystem | null
  content_tier: GameContentTier
  categories: GameCategorySlug[]
}

export type GameValidationResult =
  | { ok: true; value: ValidatedGameIdentity }
  | { ok: false; error: string }

/**
 * Validate and normalise one game row. Returns the first failure reason so
 * the seed script can write it straight into games-seed.rejected.csv.
 *
 * Slug uniqueness is NOT checked here — it is a database concern enforced
 * by the unique index (23505), which the callers translate.
 */
export function validateGameIdentity(
  input: GameIdentityInput,
): GameValidationResult {
  const name = (input.name ?? '').trim()
  if (name.length < 2) {
    return { ok: false, error: 'Name must be at least 2 characters' }
  }

  const slug = (input.slug ?? '').trim().toLowerCase()
  if (!slug) return { ok: false, error: 'Slug is required' }
  if (!GAME_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: 'Slug must be lowercase letters, numbers, and dashes only',
    }
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { ok: false, error: 'Slug must not start or end with a dash' }
  }
  if (RESERVED_GAME_SLUGS.has(slug)) {
    return {
      ok: false,
      error: `Slug "${slug}" collides with a reserved route`,
    }
  }

  const rawEcosystem = (input.ecosystem ?? '').trim().toLowerCase()
  let ecosystem: GameEcosystem | null = null
  if (rawEcosystem) {
    if (!(GAME_ECOSYSTEMS as readonly string[]).includes(rawEcosystem)) {
      return {
        ok: false,
        error: `Ecosystem must be one of: ${GAME_ECOSYSTEMS.join(', ')}`,
      }
    }
    ecosystem = rawEcosystem as GameEcosystem
  }

  const rawTier = (input.content_tier ?? 'listed').trim().toLowerCase()
  if (!(GAME_CONTENT_TIERS as readonly string[]).includes(rawTier)) {
    return {
      ok: false,
      error: `Content tier must be one of: ${GAME_CONTENT_TIERS.join(', ')}`,
    }
  }
  const content_tier = rawTier as GameContentTier

  const rawCategories = (input.categories ?? [])
    .map((c) => (c ?? '').trim().toLowerCase())
    .filter(Boolean)
  const categories: GameCategorySlug[] = []
  for (const c of rawCategories) {
    if (!(GAME_CATEGORY_SLUGS as readonly string[]).includes(c)) {
      return {
        ok: false,
        error: `Unknown category "${c}" (allowed: ${GAME_CATEGORY_SLUGS.join(', ')})`,
      }
    }
    if (!categories.includes(c as GameCategorySlug)) {
      categories.push(c as GameCategorySlug)
    }
  }
  // A game with no enabled category has nothing to sell and, under the
  // Step 1 indexability rule, nothing indexable either.
  if (categories.length === 0) {
    return { ok: false, error: 'At least one category is required' }
  }

  return { ok: true, value: { name, slug, ecosystem, content_tier, categories } }
}
