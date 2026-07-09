/**
 * Currency page mock data — V12.
 *
 * Mirrors the design handoff exactly (data.js). Real Supabase wiring
 * comes later — the page shape is what we're locking in now.
 */

// V14r — Shared delivery formatter so buyer and seller surfaces agree.
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'

export interface VolumeTier {
  min: number
  price: number
}

export interface Offer {
  id: string
  /** V14m — seller user id; used to block self-purchase on the buy panel. */
  sellerId?: string | null
  seller: string
  /** Seller's uploaded avatar (profile pic). Falls back to a hue-generated
   *  initial tile when null. */
  avatarUrl?: string | null
  /** 0–360 — used to generate the avatar gradient via oklch. */
  avatarHue: number
  verified: boolean
  /** Positive review percentage, 0–100. */
  rating: number
  reviews: number
  pricePerUnit: number
  minQty: number
  stock: number
  deliveryMin: number
  deliveryMax: number
  /** V14g — Raw seller-picked delivery label ("Instant", "5 min", "1 hr", "Custom: 2-4 hrs"). */
  deliveryLabel?: string
  blurb: string
  badges?: string[]
  ladder?: VolumeTier[]
  payments?: Array<'card' | 'paypal' | 'crypto' | 'applepay'>
  recommended?: number
}

export interface Variant {
  id: string
  label: string
  options: string[]
}

export interface Currency {
  name: string
  game: string
  glyph: string
  tagline: string
  trust: { trades: string; avgDelivery: string; shield: string }
  unitLabel: string
  variants: Variant[]
  /** V21/P7.i — Optional category logo (e.g. Robux icon) admin-uploaded
   *  via category_configs.currency_icon_url. Renders in the left card
   *  of the recommended-seller hero block. */
  iconUrl?: string | null
}

export interface CurrencyPageData {
  currency: Currency
  hero: Offer
  sellers: Offer[]
  faq: { q: string; a: string }[]
  steps: { n: number; title: string; body: string }[]
}

// V24 — Removed the `ROBUX` demo constant. It held a fully-populated
// CurrencyPageData with FAKE competitor sellers (NovaMarket, PixelVault,
// ApexGoods, s2–s11) as a "reference". It was unreferenced dead code, and
// the runtime hydrates real copy from `category_configs` in the DB (Roblox
// seed: 20260619_category_configs.sql). No fake seller data in the tree.

/**
 * V17y — Per-game shell now hydrates from the DB (category_configs).
 *
 * Previously we kept a hardcoded `REGISTRY` of currency copy keyed by
 * game slug. That doesn't scale — every new game with a currency
 * needed code changes. Now the admin sets unit_label / pricing rules
 * / FAQ / steps in /admin/games/[id]/edit → Currency tab, and this
 * function pulls those values at request time.
 *
 * The function stays the only public entry point; callers add `await`.
 * Returns null when the URL isn't the game's canonical currency slug
 * (so the page falls through to the generic items grid).
 */
import { fetchCategoryConfigBySlug } from '@/lib/actions/admin-category-configs'
import { createClient as createAnonClient } from '@/lib/supabase/server'

export async function getCurrencyShell(
  gameSlug: string,
  categorySlug: string,
): Promise<CurrencyPageData | null> {
  // V19/P5 — Route by DB metadata, not by the static GAME_CURRENCY_SLUGS
  // map. The old map gated the rich currency layout on a hardcoded list,
  // which meant new games created via the admin wizard fell through to
  // the legacy `CategoryPageLayout`. Now any (game, category) pair where
  // categories.metadata.type === 'currency' renders the rich layout.
  const supabase = await createAnonClient()
  const { data: row } = await supabase
    .from('categories')
    .select('metadata, game:games!categories_game_id_fkey(slug)')
    .eq('slug', categorySlug)
    .eq('game.slug', gameSlug)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as any
  if (!row || row.metadata?.type !== 'currency') return null

  // Fetch the per-game currency config. If admin hasn't set one yet,
  // hydrate a minimal shell from the slug so the page still renders
  // an empty state rather than 404-ing.
  const cfg = await fetchCategoryConfigBySlug(gameSlug, 'currency')

  if (!cfg) {
    // V19/P5 — Empty-state shell when admin hasn't filled the
    // currency config for this game yet. We derive the label from the
    // URL slug (strip a leading "buy-" if present, prettify the rest)
    // so the page still has reasonable copy and the rich layout shows
    // up the moment a new game is added.
    const labelFromSlug = capitalize(
      categorySlug.replace(/^buy-/, '').replace(/-/g, ' '),
    )
    return {
      currency: {
        name: labelFromSlug,
        game: capitalize(gameSlug.replace(/-/g, ' ')),
        glyph: '$',
        tagline: 'In-game currency.',
        trust: { trades: '0', avgDelivery: '—', shield: 'SafeDrop' },
        unitLabel: labelFromSlug,
        variants: [],
      },
      hero: BLANK_HERO,
      sellers: [],
      faq: [],
      steps: DEFAULT_STEPS,
    }
  }

  return {
    currency: {
      name: cfg.unit_label,
      game: capitalize(gameSlug.replace(/-/g, ' ')),
      glyph: cfg.glyph,
      tagline: cfg.tagline,
      trust: { trades: '0', avgDelivery: '—', shield: 'SafeDrop' },
      unitLabel: cfg.unit_label,
      variants: [],
    },
    hero: BLANK_HERO,
    sellers: [],
    faq: cfg.faq,
    steps: cfg.steps,
  }
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

const BLANK_HERO: Offer = {
  id: 'placeholder',
  seller: 'No seller yet',
  avatarHue: 200,
  verified: false,
  rating: 0,
  reviews: 0,
  pricePerUnit: 0,
  minQty: 100,
  stock: 0,
  deliveryMin: 0,
  deliveryMax: 0,
  blurb: 'Be the first to list this currency.',
}

const DEFAULT_STEPS = [
  { n: 1, title: 'Pick an offer',          body: 'Compare verified sellers by price, rating, and delivery speed.' },
  { n: 2, title: 'Pay securely',           body: 'Your payment is held by SafeDrop escrow until you confirm delivery.' },
  { n: 3, title: 'Receive your currency',  body: "The seller delivers via the game's transfer method. Confirm receipt and you're done." },
]

/** Parse the wizard's delivery_time string ("10min" / "instant" / "1hr"). */
function parseDeliveryTime(s: string | null | undefined): { min: number; max: number } {
  if (!s) return { min: 10, max: 10 }
  if (s === 'instant') return { min: 0, max: 1 }
  const m = s.match(/^(\d+)\s*(min|hr)$/)
  if (!m) return { min: 10, max: 10 }
  const n = parseInt(m[1], 10)
  const minutes = m[2] === 'hr' ? n * 60 : n
  return { min: minutes, max: minutes }
}

// V14r — Format moved to shared util (imported at top of file).

/** Stable hue from a string so each seller gets a consistent avatar color. */
function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

/**
 * Maps a real listing row to an Offer for the currency page.
 * `listing` is the raw row joined with seller profile data.
 */
export function listingToOffer(listing: any): Offer {
  const sellerName: string =
    listing.seller?.username ?? listing.seller?.shop_name ?? 'Seller'
  const verified: boolean =
    !!listing.seller?.is_verified ||
    (!!listing.seller?.seller_tier && listing.seller.seller_tier !== 'unverified')
  const rating: number = listing.seller?.seller_rating
    ? Math.min(99.9, Math.max(0, Number(listing.seller.seller_rating)))
    : 95
  const reviews: number = listing.seller?.total_reviews ?? 0
  const { min: deliveryMin, max: deliveryMax } = parseDeliveryTime(listing.delivery_time)
  const stock: number = listing.is_unlimited
    ? 1_000_000_000
    : (listing.quantity ?? 0)
  return {
    id: listing.id,
    sellerId: listing.seller?.id ?? null,
    seller: sellerName,
    avatarUrl: listing.seller?.avatar_url ?? null,
    avatarHue: hashHue(sellerName),
    verified,
    rating,
    reviews,
    pricePerUnit: Number(listing.price ?? 0),
    // V14 — Currency listings enforce a 100-unit floor. Defensive: bump up
    // any legacy row that slipped in below the new minimum.
    minQty: Math.max(100, listing.min_quantity ?? 100),
    stock,
    deliveryMin,
    deliveryMax,
    deliveryLabel: formatDeliveryLabel(listing.delivery_time),
    blurb: (listing.description ?? '').trim(),
    recommended: Math.round(rating),
  }
}

// Back-compat: keep the old name so existing imports work, falling
// back to the shell for read-only consumers.
export async function getCurrencyPageData(
  gameSlug: string,
  categorySlug: string,
): Promise<CurrencyPageData | null> {
  return getCurrencyShell(gameSlug, categorySlug)
}
