/**
 * Auto-SEO template engine.
 *
 * One place that produces title / meta description / H1 / visible intro /
 * FAQ / keywords for game hubs and category pages. Every field is:
 *   1. an admin override (games.seo_*, categories.seo_*) if set, else
 *   2. generated from a smart, product-type-aware template.
 *
 * This is the growth engine: a newly-added game/category is instantly
 * crawlable with real copy and FAQ, no manual SEO work. Pages call the
 * resolvers below instead of hand-writing metadata inline.
 *
 * Copy follows the PSP-safe wording rule (SafeDrop Buyer Protection,
 * "sellers are paid after you confirm" — never "escrow / we hold funds").
 */

export type ProductType =
  | 'currency'
  | 'account'
  | 'items'
  | 'skin'
  | 'boosting'
  | 'coaching'
  | 'top_up'
  | 'gift_card'
  | 'service'

export interface SeoFaqItem {
  q: string
  a: string
}

/** Resolved, ready-to-render SEO bundle for a page. */
export interface ResolvedSeo {
  title: string
  description: string
  h1: string
  /** Visible intro paragraph (SSR) — helps clear the content floor. */
  intro: string
  keywords: string[]
  faq: SeoFaqItem[]
}

/* ── helpers ─────────────────────────────────────────────────────────── */

const clamp = (s: string, max: number) => {
  if (s.length <= max) return s
  // Break on the last word boundary before the limit, not mid-word.
  const cut = s.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max - 25 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** First non-empty override wins; otherwise the template value. */
const pick = (override: string | null | undefined, fallback: string) => {
  const v = (override ?? '').trim()
  return v.length > 0 ? v : fallback
}

const lc = (s: string) => s.toLowerCase()

/* ── game hub ────────────────────────────────────────────────────────── */

export interface GameSeoInput {
  name: string
  /** Human category labels the game actually has enabled, in display order. */
  categoryLabels?: string[]
  /** Which product types the game has, to tune the title/copy. */
  hasAccounts?: boolean
  ecosystem?: string | null
  description?: string | null
  overrides?: {
    seo_title?: string | null
    seo_description?: string | null
    seo_h1?: string | null
    seo_intro?: string | null
  } | null
}

export function resolveGameSeo(input: GameSeoInput): ResolvedSeo {
  const { name } = input
  const o = input.overrides ?? {}
  const cats = input.categoryLabels?.length
    ? input.categoryLabels
    : ['items', 'currency', 'accounts']
  const primary = cats.slice(0, 3).map(lc).join(', ')

  // Title stays ≤60 chars after the " | DropMarket" suffix the layout adds.
  const titleTemplate =
    name.length > 12
      ? `Buy & Sell ${name} Items & Currency`
      : input.hasAccounts
        ? `Buy & Sell ${name} Items, Currency & Accounts`
        : `Buy & Sell ${name} Items & Currency`

  const descTemplate = clamp(
    `Buy and sell ${name} digital goods on DropMarket. Compare verified seller offers for ${primary}, delivery times, prices and SafeDrop Buyer Protection.`,
    160,
  )

  const h1Template = `Buy and Sell ${name} on DropMarket`

  const introTemplate =
    `Browse ${name} ${primary} from verified sellers on DropMarket. ` +
    `Compare prices, stock and delivery times, then buy with confidence — ` +
    `every order is covered by SafeDrop Buyer Protection, so the seller is ` +
    `paid only after you confirm you received exactly what was described. ` +
    `If something is wrong or never arrives, you get your money back. Every ` +
    `${name} seller is verified before they can list.`

  return {
    title: pick(o.seo_title, titleTemplate),
    description: pick(o.seo_description, descTemplate),
    h1: pick(o.seo_h1, h1Template),
    intro: pick(o.seo_intro, introTemplate),
    keywords: [
      `buy ${lc(name)}`,
      `sell ${lc(name)}`,
      `${lc(name)} marketplace`,
      `${lc(name)} items`,
      `${lc(name)} currency`,
      ...(input.hasAccounts ? [`${lc(name)} accounts`] : []),
    ],
    faq: gameFaq(name),
  }
}

function gameFaq(name: string): SeoFaqItem[] {
  return [
    {
      q: `Is it safe to buy ${name} items and currency on DropMarket?`,
      a: `Yes. Every ${name} order is covered by SafeDrop Buyer Protection — the seller is paid only after you confirm you received exactly what was described. If it's not delivered or not as described, you get your money back.`,
    },
    {
      q: `How fast is ${name} delivery?`,
      a: `Most ${name} orders are delivered within minutes by verified sellers. The exact delivery time is shown on every listing before you buy.`,
    },
    {
      q: `Are ${name} sellers on DropMarket verified?`,
      a: `Yes — every ${name} seller is ID-checked and payment-verified before they can list, and each storefront shows live ratings and trade history.`,
    },
  ]
}

/* ── category page ───────────────────────────────────────────────────── */

export interface CategorySeoInput {
  gameName: string
  categoryLabel: string
  productType: ProductType | string | null
  /** Live stats for richer copy — pass what you have. */
  listingCount?: number
  fromPriceLabel?: string | null
  avgDeliveryLabel?: string | null
  overrides?: {
    seo_title?: string | null
    seo_description?: string | null
    seo_h1?: string | null
    seo_intro?: string | null
  } | null
}

/** Title verb/noun per product type (spec §7 templates). */
function categoryTitleTemplate(game: string, label: string, type: string): string {
  switch (type) {
    case 'currency':
      return `Buy ${game} ${label} | Fast Delivery on DropMarket`
    case 'account':
      return `Buy ${game} ${label} | Safe Account Marketplace`
    case 'boosting':
    case 'service':
      return `Buy ${game} ${label} | Verified Boosters on DropMarket`
    case 'coaching':
      return `Buy ${game} ${label} | Learn from Verified Coaches`
    case 'top_up':
      return `Buy ${game} ${label} | Instant Top-Ups on DropMarket`
    case 'gift_card':
      return `Buy ${game} ${label} | Digital Codes on DropMarket`
    default:
      return `Buy ${game} ${label} | Verified Sellers on DropMarket`
  }
}

export function resolveCategorySeo(input: CategorySeoInput): ResolvedSeo {
  const { gameName, categoryLabel } = input
  const type = String(input.productType ?? 'items')
  const o = input.overrides ?? {}

  const titleTemplate = clamp(categoryTitleTemplate(gameName, categoryLabel, type), 60)

  const stat =
    input.listingCount && input.listingCount > 0
      ? `${input.listingCount} live listing${input.listingCount === 1 ? '' : 's'}${input.fromPriceLabel ? ` from ${input.fromPriceLabel}` : ''}. `
      : ''

  const descTemplate = clamp(
    `Compare ${gameName} ${lc(categoryLabel)} offers from verified sellers on DropMarket. ${stat}Check prices, stock and delivery times, all covered by SafeDrop Buyer Protection.`,
    160,
  )

  const h1Template = `Buy ${gameName} ${categoryLabel}`

  const introTemplate =
    `Compare ${gameName} ${lc(categoryLabel)} from verified sellers on DropMarket. ` +
    `${stat}Every order is protected by SafeDrop Buyer Protection — the seller is ` +
    `paid only after you confirm delivery, so you get exactly what you ordered or ` +
    `your money back. Sort by price, delivery speed or seller rating to find the ` +
    `right offer.`

  return {
    title: pick(o.seo_title, titleTemplate),
    description: pick(o.seo_description, descTemplate),
    h1: pick(o.seo_h1, h1Template),
    intro: pick(o.seo_intro, introTemplate),
    keywords: [
      `buy ${lc(gameName)} ${lc(categoryLabel)}`,
      `${lc(gameName)} ${lc(categoryLabel)} for sale`,
      `cheap ${lc(gameName)} ${lc(categoryLabel)}`,
      `${lc(gameName)} marketplace`,
    ],
    faq: categoryFaq(gameName, categoryLabel, type),
  }
}

function categoryFaq(game: string, label: string, type: string): SeoFaqItem[] {
  const base: SeoFaqItem[] = [
    {
      q: `Is buying ${game} ${lc(label)} on DropMarket safe?`,
      a: `Yes — every ${game} ${lc(label)} order is covered by SafeDrop Buyer Protection. The seller is paid only after you confirm you received exactly what was described, so you get what you ordered or your money back.`,
    },
    {
      q: `How much does ${game} ${lc(label)} cost?`,
      a: `Prices are set by independent verified sellers competing on price, speed and reputation, so ${game} ${lc(label)} is usually cheaper than first-party stores. The lowest live price is shown at the top of the page.`,
    },
  ]
  if (type === 'account') {
    base.push({
      q: `What should I check before buying a ${game} account?`,
      a: `Review the listed account details, the seller's rating and trade history, and the stated delivery time. Every ${game} account order is covered by SafeDrop, so if the account isn't as described you're protected.`,
    })
  } else {
    base.push({
      q: `How fast is ${game} ${lc(label)} delivered?`,
      a: `Most ${game} ${lc(label)} orders are delivered within minutes by verified sellers. The exact delivery time is shown on each listing before you buy.`,
    })
  }
  return base
}
