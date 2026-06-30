/**
 * V17y — Category config TypeScript shapes.
 *
 * The DB stores `category_configs.config` as JSONB; these types are
 * the contract for what each `category_type` row holds. Admin forms,
 * server actions, and buyer-side pages all import from here so the
 * shape stays consistent across read and write paths.
 *
 * When you add a field:
 *   1. Extend the interface here (mark optional if old rows won't
 *      have it).
 *   2. Update the admin form component to expose the field.
 *   3. Update the seed migration if there's a sensible default.
 *
 * Renaming or removing a field is a breaking change — old config
 * blobs in the DB still have the old key. Migrate intentionally.
 */

/* ── Platform fields (shared) ─────────────────────────────────────
   Used to express "the seller must pick a Region / Platform / Device
   from these options before listing." Lives at the (game, category)
   level so PoE currency can require Region while Genshin currency
   doesn't. The seller wizard renders a shadcn Select for each enabled
   field; an empty `options` list disables the field even if enabled. */

export type PlatformFieldKind = 'region' | 'platform' | 'device'

/**
 * V19/P24/P7 — Each option carries an optional icon_url. Original
 * shape was `string[]` (plain labels). We accept both formats at
 * read time via `normalizePlatformOptions` below — old data keeps
 * working, new data gets icons.
 */
export interface PlatformOption {
  value: string
  icon_url?: string | null
}

export interface PlatformFieldDef {
  enabled: boolean
  /**
   * Options the seller picks from. Empty list = treat as disabled.
   * V19/P24/P7 — Stored as PlatformOption[] going forward; legacy
   * `string[]` blobs in the DB are still readable. Use
   * `normalizePlatformOptions(opts)` to convert at the boundary.
   */
  options: PlatformOption[]
}

export type PlatformFields = Partial<Record<PlatformFieldKind, PlatformFieldDef>>

export const DEFAULT_PLATFORM_FIELDS: PlatformFields = {
  region:   { enabled: false, options: [] },
  platform: { enabled: false, options: [] },
  device:   { enabled: false, options: [] },
}

/**
 * V19/P24/P7 — Back-compat reader. Old JSONB rows stored options as
 * `string[]`; new rows store `PlatformOption[]`. Both flow into the
 * same downstream code via this helper. Safe to call on undefined/
 * null/wrong-typed input — always returns a PlatformOption[].
 */
export function normalizePlatformOptions(
  raw: unknown,
): PlatformOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry): PlatformOption | null => {
      if (typeof entry === 'string') return { value: entry, icon_url: null }
      if (entry && typeof entry === 'object' && 'value' in entry) {
        const value = String((entry as any).value ?? '').trim()
        if (!value) return null
        const icon = (entry as any).icon_url
        return {
          value,
          icon_url: typeof icon === 'string' && icon ? icon : null,
        }
      }
      return null
    })
    .filter((x): x is PlatformOption => x !== null)
}

/* ── Currency ────────────────────────────────────────────────────── */

export interface CurrencyConfig {
  /** Display name of the currency unit ("Robux", "Sheckles", "Cash"). */
  unit_label: string
  /** Short glyph for visual headers ("R$", "🌱", "$"). */
  glyph: string
  /** One-line tagline shown above the hero card. */
  tagline: string
  /** Cheapest per-unit price the seller-side wizard accepts. */
  price_floor: number
  /** Most expensive per-unit price the seller-side wizard accepts. */
  price_ceiling: number
  /** What the page surfaces as a "recommended" or "average" price for buyers. */
  recommended_price: number
  /** Smallest order quantity the buyer can pick. */
  min_quantity: number
  /** Step the +/- buttons use on the quantity stepper. */
  quantity_step: number
  /**
   * V19/P2.b — Quantity granularity: the unit each "1" of quantity
   * represents in this category. Drives the suffix shown next to
   * quantity inputs/displays everywhere (seller wizard Stock card,
   * buyer page stepper, listing cards). Pick `unit` for currencies
   * that trade in absolute counts (e.g. PoE Orbs), `thousand` for
   * Robux/V-Bucks-style bulk currencies, `million` for high-volume
   * tokens.
   */
  quantity_granularity: 'unit' | 'thousand' | 'million'
  /** Placeholder shown in the seller's "instructions to buyer" field. */
  seller_instructions_placeholder: string
  /** FAQ block on the buyer page. */
  faq: Array<{ q: string; a: string }>
  /** "How it works" 3-step trust band. */
  steps: Array<{ n: number; title: string; body: string }>
  /**
   * V19/P3 — Per-game platform/region/device requirements. Empty
   * object (or any kind set to enabled:false) means the seller
   * wizard skips that field. Currency for Roblox / Robux skips all
   * three; PoE currency requires Region + Device; etc.
   */
  platform_fields?: PlatformFields
  /**
   * V19/P24 — Image URL for the currency's own logo (the V-Bucks
   * pile, the Robux R$, the Genshin Crystal). Shown beside the
   * page title on the buyer page. Optional; empty falls back to the
   * game's logo.
   */
  currency_icon_url?: string | null
  /**
   * V19/P24 — Fixed-bundle list. When empty/undefined the currency
   * is in "flexible" mode (sellers pick any quantity, buyers use a
   * stepper — the Robux flow). When at least one bundle exists the
   * currency switches to "bundle" mode: sellers pick from this
   * list, buyers pick region + bundle and see sellers for that
   * exact combo. Mirrors how Fortnite V-Bucks / Apex Coins / mobile
   * top-ups sell in fixed bundles.
   *
   * `amount` is the headline number (used for sorting low → high
   * and as a tiebreaker price comparison). Subscriptions like
   * "Crew 1 Month" use amount: 0 plus an explicit sort_order so
   * they group above the count-based bundles.
   */
  bundles?: CurrencyBundle[]
}

export interface CurrencyBundle {
  /** Stable id used by listings.bundle_id. Generate with uuid or slug. */
  id: string
  /** Display label ("800 V-Bucks", "Fortnite Crew 1 Month"). */
  name: string
  /** Headline amount. 0 for subscriptions / non-quantitative bundles. */
  amount: number
  /** Image shown in the bundle card (publicly-served URL). */
  icon_url?: string | null
  /** Manual sort order; smaller renders first. Defaults to 0. */
  sort_order?: number
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  unit_label: 'Currency',
  glyph: '$',
  tagline: 'In-game currency.',
  price_floor: 0.001,
  price_ceiling: 10,
  recommended_price: 0.01,
  min_quantity: 100,
  quantity_step: 100,
  quantity_granularity: 'unit',
  seller_instructions_placeholder: "Describe how you'll deliver the currency.",
  faq: [],
  steps: [
    { n: 1, title: 'Pick an offer', body: 'Compare verified sellers by price, rating, and delivery speed.' },
    { n: 2, title: 'Pay securely', body: 'Your payment is held by VaultShield escrow until you confirm delivery.' },
    { n: 3, title: 'Receive your currency', body: "The seller delivers via the game's transfer method. Confirm receipt and you're done." },
  ],
  platform_fields: DEFAULT_PLATFORM_FIELDS,
  currency_icon_url: null,
  bundles: [],
}

/* ── Account ─────────────────────────────────────────────────────── */

/**
 * Fields the seller is required to fill in when listing a game
 * account. Admin picks which checkboxes apply for this game so the
 * sell wizard only shows what's relevant.
 */
export type AccountField =
  | 'level'
  | 'rank'
  | 'region'
  | 'platform'
  | 'skins_count'
  | 'hours_played'
  | 'email_changeable'

export interface AccountConfig {
  /** Required attributes the seller must provide for any listing. */
  required_fields: AccountField[]
  /** Available delivery methods (manual handover, instant credentials, etc.). */
  delivery_methods: Array<'manual' | 'instant'>
  /** Placeholder for the seller's description field. */
  seller_instructions_placeholder: string
  /** Whether 2FA-on accounts are allowed for sale. */
  allow_2fa_accounts: boolean
}

export const DEFAULT_ACCOUNT_CONFIG: AccountConfig = {
  required_fields: ['level'],
  delivery_methods: ['manual'],
  seller_instructions_placeholder: 'Describe the account and how the buyer will receive credentials.',
  allow_2fa_accounts: false,
}

/* ── Boosting (service) ──────────────────────────────────────────── */

export interface BoostingConfig {
  /**
   * Named tiers the seller can pick from when listing a boosting
   * service. e.g. for Valorant: ["Iron", "Bronze", "Silver", ...,
   * "Radiant"]. Plain string list; ordering matters (low → high).
   */
  tiers: string[]
  /**
   * Average delivery hours the page surfaces as a benchmark.
   */
  avg_delivery_hours: number
  /** Placeholder text in the seller's instructions field. */
  seller_instructions_placeholder: string
}

export const DEFAULT_BOOSTING_CONFIG: BoostingConfig = {
  tiers: [],
  avg_delivery_hours: 24,
  seller_instructions_placeholder: "Describe what you'll do and what the buyer needs to provide.",
}

/* ── Items / Top-up — currently no admin-level config ────────────── */

/**
 * Items uses the existing per-template attribute builder (template
 * builder), and top-up listings follow the same pattern as items.
 * We don't store extra config here for them yet — the template
 * builder IS the config.
 */

/* ── Union for typed lookups ─────────────────────────────────────── */

export type CategoryConfigType = 'currency' | 'account' | 'service' | 'items' | 'top_up'

export type CategoryConfigByType = {
  currency: CurrencyConfig
  account: AccountConfig
  service: BoostingConfig
  items: Record<string, never>
  top_up: Record<string, never>
}
