/**
 * V17g — Canonical category slug map.
 *
 * Single source of truth for what slug each (game, category type) pair
 * should use in URLs. Replaces the old _currencyData.ts aliases setup,
 * which relied on 301 redirects (and caused the navbar flicker).
 *
 * Pattern, derived from SEO research vs GameBoost / G2G / Eldorado /
 * PlayerAuctions and Google's 2025-26 ecommerce category guidance:
 *
 *   • Currency   → /{game}/buy-{currency-name}   e.g. /roblox/buy-robux
 *   • Accounts   → /{game}/buy-accounts          (game in URL, "buy" intent)
 *   • Items      → /{game}/buy-items             (game in URL, "buy" intent)
 *   • Boosting   → /{game}/boosting              (no "buy-"; "buy boosting"
 *                                                  isn't a real query)
 *   • Top-up     → /{game}/top-up                (mobile-game term of art)
 *   • Coaching   → /{game}/coaching              (service noun, no "buy-")
 *
 * Why this beats /buy-robux (no game prefix):
 *   1. Multi-game currencies collide (gold, gems, credits exist in many
 *      games). Forcing a game prefix avoids future renames.
 *   2. Topical clustering — every /{game}/* page reinforces the {game}
 *      cluster's domain authority, which compounds as you add categories.
 *   3. URLs read as breadcrumbs in SERP snippets, which buyers prefer.
 *
 * To add a new game from the admin wizard, just add an entry to
 * GAME_CURRENCY_NAMES below (if the game has a currency). Account /
 * items / boosting / top-up don't need per-game entries — they're
 * always the same slug.
 */

/**
 * Per-game currency real name → URL slug fragment.
 * Empty/missing entry means the game doesn't have a currency category.
 *
 * Keep names singular, lowercase, hyphenated. The final URL slug is
 * always `buy-{value}` — this map is the {value} half.
 */
export const GAME_CURRENCY_SLUGS: Record<string, string> = {
  roblox: 'robux',
  fortnite: 'vbucks',
  valorant: 'vp',
  'gta-v': 'gta-money',
  minecraft: 'minecoins',
  'league-of-legends': 'rp',
  fc25: 'coins',
  'escape-from-tarkov': 'roubles',
  'r6-siege': 'credits',
  'grow-a-garden': 'sheckles',
  'steal-a-brainrot': 'cash',
}

/**
 * Category type (from categories.metadata.type) → canonical slug rule.
 * Function form so currency can plug in the per-game name.
 */
export type CategoryType = 'currency' | 'account' | 'items' | 'service' | 'top_up'

export function getCanonicalCategorySlug(
  gameSlug: string,
  categoryType: CategoryType,
  /** For categoryType='service', specify what kind: 'boosting' | 'coaching' | 'servers'.
   *  Optional because most services default to 'boosting'. */
  serviceSubtype?: string,
): string | null {
  switch (categoryType) {
    case 'currency': {
      const currencyName = GAME_CURRENCY_SLUGS[gameSlug]
      // V17g — When a new game is created via admin but doesn't have an
      // entry in GAME_CURRENCY_SLUGS yet, fall back to `buy-currency`.
      // Admin can rename it via the wizard later. We DON'T return null
      // because that would block the bridge from creating the row at all.
      if (!currencyName) return 'buy-currency'
      return `buy-${currencyName}`
    }
    case 'account':
      return 'buy-accounts'
    case 'items':
      return 'buy-items'
    case 'top_up':
      return 'top-up'
    case 'service':
      // Services aren't "bought" linguistically — searchers query
      // "{game} boosting" not "buy {game} boosting". Keep bare.
      return serviceSubtype ?? 'boosting'
    default:
      return null
  }
}

/**
 * For special-case categories that aren't covered by the simple map
 * above (gift-cards, limiteds, server-items, modded-accounts, unlocks,
 * skins, etc.) we keep the original slug. They're niche enough that
 * they don't fit a single canonical pattern, but they should still get
 * "buy-" prefix if they're a "what you can purchase" noun.
 */
export const SPECIAL_CATEGORY_SLUG_MAP: Record<string, string> = {
  // gift-cards stays as-is (it's already the canonical form on every
  // marketplace).
  'gift-cards': 'gift-cards',
  // limiteds is the established Roblox community term — both Eldorado
  // and PlayerAuctions use it bare. Don't add "buy-".
  limiteds: 'limiteds',
  // GTA-V specifics — these are "what you buy" so add buy- prefix.
  'modded-accounts': 'buy-modded-accounts',
  unlocks: 'buy-unlocks',
  // Fortnite skins — searched as "buy fortnite skins" so add buy-.
  skins: 'buy-skins',
  // Minecraft server-items
  'server-items': 'buy-server-items',
  // Minecraft servers (service category, not a noun to buy)
  servers: 'servers',
}

/**
 * Resolve a category's canonical slug given the input we know about it.
 * Falls back to the special-case map for slugs that don't fit the
 * simple type rules.
 */
export function resolveCategorySlug(input: {
  gameSlug: string
  categoryType?: CategoryType | null
  /** Current slug as stored in the DB (might be legacy or special). */
  currentSlug?: string | null
  serviceSubtype?: string
}): string | null {
  // Special-case map wins when the current slug matches a known special.
  if (input.currentSlug && SPECIAL_CATEGORY_SLUG_MAP[input.currentSlug]) {
    return SPECIAL_CATEGORY_SLUG_MAP[input.currentSlug]
  }
  if (input.categoryType) {
    const fromType = getCanonicalCategorySlug(
      input.gameSlug,
      input.categoryType,
      input.serviceSubtype,
    )
    if (fromType) return fromType
  }
  return input.currentSlug ?? null
}
