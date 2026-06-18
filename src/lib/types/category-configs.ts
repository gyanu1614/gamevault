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
  /** Placeholder shown in the seller's "instructions to buyer" field. */
  seller_instructions_placeholder: string
  /** FAQ block on the buyer page. */
  faq: Array<{ q: string; a: string }>
  /** "How it works" 3-step trust band. */
  steps: Array<{ n: number; title: string; body: string }>
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
  seller_instructions_placeholder: "Describe how you'll deliver the currency.",
  faq: [],
  steps: [
    { n: 1, title: 'Pick an offer', body: 'Compare verified sellers by price, rating, and delivery speed.' },
    { n: 2, title: 'Pay securely', body: 'Your payment is held by VaultShield escrow until you confirm delivery.' },
    { n: 3, title: 'Receive your currency', body: "The seller delivers via the game's transfer method. Confirm receipt and you're done." },
  ],
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
