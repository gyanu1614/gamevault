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
}

export interface CurrencyPageData {
  currency: Currency
  hero: Offer
  sellers: Offer[]
  faq: { q: string; a: string }[]
  steps: { n: number; title: string; body: string }[]
}

const ROBUX: CurrencyPageData = {
  currency: {
    name: 'Robux',
    game: 'Roblox',
    glyph: 'R$',
    tagline:
      'In-game currency for Roblox — buy avatar items, game passes, and premium content.',
    trust: { trades: '12,847', avgDelivery: '8 min', shield: 'VaultShield' },
    unitLabel: 'Robux',
    variants: [],
  },
  hero: {
    id: 'h1',
    seller: 'ApexGoods',
    avatarHue: 86,
    verified: true,
    rating: 99.8,
    reviews: 4218,
    pricePerUnit: 0.0047,
    minQty: 1000,
    stock: 4_200_000,
    deliveryMin: 5,
    deliveryMax: 12,
    badges: ['Money-back guarantee', 'Instant delivery', 'VaultShield protected'],
    blurb:
      'Top-rated bulk seller. 24/7 automated delivery, no password required — gifted via group payout.',
    ladder: [
      { min: 1000, price: 0.0047 },
      { min: 5000, price: 0.0044 },
      { min: 10000, price: 0.0041 },
      { min: 50000, price: 0.0038 },
    ],
    payments: ['card', 'paypal', 'crypto', 'applepay'],
  },
  sellers: [
    { id: 's2',  seller: 'NovaMarket',  avatarHue: 200, verified: true,  rating: 99.6, reviews: 3110, pricePerUnit: 0.0048, minQty: 500,   stock: 1_800_000,  deliveryMin: 8,  deliveryMax: 20, recommended: 96, blurb: 'Reliable mid-volume seller. Manual delivery within stated window, friendly support in EU hours.', payments: ['card','paypal','crypto'] },
    { id: 's3',  seller: 'PixelVault',  avatarHue: 320, verified: true,  rating: 99.9, reviews: 8740, pricePerUnit: 0.0051, minQty: 1000,  stock: 9_200_000,  deliveryMin: 3,  deliveryMax: 7,  recommended: 95, blurb: 'Highest review count on the platform. Fully automated payout, instant 24/7. Slightly higher price for that reliability.', payments: ['card','paypal','crypto','applepay'] },
    { id: 's4',  seller: 'QuickCoin',   avatarHue: 28,  verified: true,  rating: 98.4, reviews: 1290, pricePerUnit: 0.0045, minQty: 2000,  stock: 600_000,    deliveryMin: 2,  deliveryMax: 6,  recommended: 90, blurb: 'Cheapest verified seller for bulk orders. Limited stock, restocks daily. Crypto preferred for fastest release.', payments: ['crypto','card'] },
    { id: 's5',  seller: 'GuildSupply', avatarHue: 260, verified: true,  rating: 99.2, reviews: 2050, pricePerUnit: 0.0049, minQty: 1000,  stock: 3_400_000,  deliveryMin: 10, deliveryMax: 30, recommended: 88, blurb: 'Established guild-run shop. Delivery via in-experience gifting; provide your username at checkout.', payments: ['card','paypal'] },
    { id: 's6',  seller: 'ByteBazaar',  avatarHue: 150, verified: false, rating: 97.1, reviews: 412,  pricePerUnit: 0.0043, minQty: 5000,  stock: 250_000,    deliveryMin: 15, deliveryMax: 45, recommended: 78, blurb: 'New unverified seller, lowest headline price. Larger minimum order. Building reputation — buyer protection still applies.', payments: ['crypto'] },
    { id: 's7',  seller: 'OrbitTrades', avatarHue: 12,  verified: true,  rating: 99.4, reviews: 5630, pricePerUnit: 0.0050, minQty: 1000,  stock: 7_100_000,  deliveryMin: 5,  deliveryMax: 15, recommended: 92, blurb: 'High-volume veteran. Multiple delivery methods available; supports NA & EU regions with localized support.', payments: ['card','paypal','crypto','applepay'] },
    { id: 's8',  seller: 'LunaGoods',   avatarHue: 290, verified: true,  rating: 98.9, reviews: 980,  pricePerUnit: 0.0052, minQty: 500,   stock: 120_000,    deliveryMin: 6,  deliveryMax: 18, recommended: 84, blurb: 'Small boutique seller, fast responses. Low minimum order — good for top-ups rather than bulk.', payments: ['paypal','card'] },
    { id: 's9',  seller: 'TitanReserve',avatarHue: 220, verified: true,  rating: 99.7, reviews: 6420, pricePerUnit: 0.0046, minQty: 10000, stock: 22_000_000, deliveryMin: 4,  deliveryMax: 10, recommended: 93, blurb: 'Largest stock on the marketplace. Built for very large orders (10k+). Automated, instant, money-back guaranteed.', payments: ['card','paypal','crypto','applepay'] },
    { id: 's10', seller: 'EchoMart',    avatarHue: 340, verified: false, rating: 96.3, reviews: 188,  pricePerUnit: 0.0044, minQty: 3000,  stock: 80_000,     deliveryMin: 20, deliveryMax: 60, recommended: 70, blurb: 'Budget option, unverified. Manual delivery, slower window. Decent for non-urgent bulk buys.', payments: ['crypto'] },
    { id: 's11', seller: 'AuroraTrade', avatarHue: 175, verified: true,  rating: 99.1, reviews: 1740, pricePerUnit: 0.0049, minQty: 1000,  stock: 2_600_000,  deliveryMin: 7,  deliveryMax: 22, recommended: 86, blurb: 'Consistent seller with strong dispute record. Standard automated delivery during stated window.', payments: ['card','paypal','crypto'] },
  ],
  faq: [
    { q: 'How fast is delivery?', a: 'Most orders are delivered automatically within minutes — the average across all Robux sellers is about 8 minutes. Each seller lists their own delivery window on their offer; automated sellers are near-instant, while manual sellers deliver within the range shown. You’ll get a notification the moment your currency is on the way.' },
    { q: 'Is buying Robux safe?', a: 'Yes. Every trade on GameVault is covered by VaultShield, which holds your payment until you confirm you’ve received your Robux. Sellers are rated by real buyers, and verified sellers have passed identity and reliability checks. If anything goes wrong, you’re protected by our money-back guarantee.' },
    { q: 'What if I don’t receive my currency?', a: 'If a seller fails to deliver within their stated window, open a dispute from your order page. VaultShield has not released the funds yet, so you get a full refund automatically. Our support team reviews disputes 24/7 and most are resolved within an hour.' },
    { q: 'Do I need to share my password?', a: 'No — never. Legitimate Robux delivery on GameVault is done through in-experience gifting or group payouts, which only require your username. Any seller asking for your password is violating our rules; report them and your order is protected.' },
    { q: 'What payment methods do you accept?', a: 'We accept major credit and debit cards, PayPal, Apple Pay, and a range of cryptocurrencies. Individual sellers may accept a subset — the methods each seller supports are shown when you expand their offer.' },
    { q: 'What’s your refund policy?', a: 'Because payments are held in escrow by VaultShield until delivery is confirmed, you can request a full refund any time before you confirm receipt. After confirmation, refunds are handled case-by-case through our dispute process.' },
    { q: 'Why is your price different from buying in-game?', a: 'Marketplace prices reflect supply and demand between independent sellers, and are often lower per unit than first-party pricing — especially in bulk. Prices also vary by platform and region due to local pricing and fees, which is why you can filter by both above.' },
  ],
  steps: [
    { n: 1, title: 'Pick an offer',           body: 'Compare verified sellers by price, rating, and delivery speed. The recommended offer balances all three.' },
    { n: 2, title: 'Pay securely',            body: 'Your payment is held by VaultShield escrow — the seller is only paid once you confirm delivery.' },
    { n: 3, title: 'Receive your currency',   body: 'The seller delivers via in-game gifting. Confirm receipt and you’re done — no password ever required.' },
  ],
}

/**
 * Per-game shell — describes the currency (name, tagline, glyph, copy) but
 * not the offers. Real offers come from the listings table at runtime.
 *
 * Aliases describe every URL slug that should resolve to this currency.
 * `canonical` is the SEO-friendly URL we want search engines to index
 * (e.g. `/roblox/buy-robux`).
 */
interface CurrencyEntry {
  shell: CurrencyPageData
  aliases: string[]
  canonical: string
}

const REGISTRY: Record<string, CurrencyEntry> = {
  roblox: {
    shell: ROBUX,
    // Every slug that should serve the Robux page.
    aliases: ['buy-robux', 'robux', 'currency'],
    // The one we want search engines + share links to use.
    canonical: 'buy-robux',
  },
}

export function getCurrencyShell(
  gameSlug: string,
  categorySlug: string,
): CurrencyPageData | null {
  const entry = REGISTRY[gameSlug]
  if (!entry) return null
  return entry.aliases.includes(categorySlug) ? entry.shell : null
}

/** Returns the SEO-canonical slug for this game's currency page, or null. */
export function getCurrencyCanonicalSlug(gameSlug: string): string | null {
  return REGISTRY[gameSlug]?.canonical ?? null
}

/** True when the given URL slug is a known currency alias for the game. */
export function isCurrencyAlias(gameSlug: string, categorySlug: string): boolean {
  const entry = REGISTRY[gameSlug]
  return !!entry && entry.aliases.includes(categorySlug)
}

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

// Back-compat: keep the old name so existing imports work, falling back
// to the shell for read-only consumers.
export function getCurrencyPageData(
  gameSlug: string,
  categorySlug: string,
): CurrencyPageData | null {
  return getCurrencyShell(gameSlug, categorySlug)
}
