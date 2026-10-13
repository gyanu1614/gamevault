/**
 * Buy rails (growth point 2): the sticky desktop rails, the phone buy bar,
 * the value-list buy line and the calculator buy box. Pure: the copy, the
 * links and the show/hide rules. Server reads live in ./server, the UI in
 * src/components/buy-rails.
 *
 * Every number is LIVE (a real cheapest price + a real offer count from our
 * own listings); with no offers a card flips to the seller ask instead of
 * showing an empty buy card.
 */
import { foundingHref } from '@/lib/seo/founding-href'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import { formatUsd } from '@/lib/value-listings/format'
import { itemBuyHref, type ItemStock } from '@/lib/value-listings/buy-state'

export type RailSurface = 'blog' | 'value_item' | 'value_list' | 'calculator'
export type RailPosition = 'left' | 'right' | 'bar' | 'column' | 'box'
export type RailVariant = 'buy' | 'sell'
export type RailKind = 'currency' | 'items' | 'item'

export interface RailSettings {
  blog: boolean
  value_item: boolean
  value_list: boolean
  calculator: boolean
}

export const RAILS_ON: RailSettings = { blog: true, value_item: true, value_list: true, calculator: true }

/** Fails open: only an explicit `false` turns a surface off. */
export function parseRailSettings(row: unknown): RailSettings {
  if (!row || typeof row !== 'object') return RAILS_ON
  const r = row as Record<string, unknown>
  return {
    blog: r.blog !== false,
    value_item: r.value_item !== false,
    value_list: r.value_list !== false,
    calculator: r.calculator !== false,
  }
}

/** One card, shared by the rails and the phone bar. */
export interface RailCard {
  variant: RailVariant
  kind: RailKind
  /** Card heading: "Buy Robux", "Steal an Egg Items", "Buy Bat Dragon", "Have a Frost Fury?". */
  title: string
  /** Short name for the phone bar: "Robux", "Steal an Egg Items", "Bat Dragon". */
  name: string
  /** Lines under the heading. */
  lines: string[]
  /** The phone bar's one line. */
  summary: string
  /** Typical delivery ("15 Mins"), item cards only. */
  meta: string | null
  cta: string
  /** The desktop rail's button: the price lives in it ("Buy From $42"), so the lines carry the count. */
  buyLabel: string
  /** The buy page. Sell cards resolve their link client-side (sellHref). */
  href: string
  image: { src: string; alt: string } | null
  /** Background art for the tall desktop rail (the game's CTA banner art). */
  art: string | null
  game: string
  item: string | null
  /** game_categories.type the Sell link prefills. */
  categoryType: 'currency' | 'items'
}

const NO_SELLERS = 'No sellers yet · list it first'

export function offersLabel(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'offer' : 'offers'}`
}

/** "$0.0052" for per-unit rates, "$1.20" / "$42" otherwise. */
function price(usd: number): string {
  return usd >= 1 ? formatUsd(usd) : `$${formatStatPrice(usd)}`
}

function hasOffers(count: number, lowPrice: number | null | undefined): lowPrice is number {
  return count > 0 && lowPrice != null && lowPrice > 0
}

/** "a Frost Fury", "an Owl". */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`
}

export function currencyCard(input: {
  gameSlug: string
  unitLabel: string
  granularity: 'unit' | 'thousand' | 'million' | null | undefined
  /** False for bundle games (V-Bucks packs): the price is a pack, not a unit. */
  perUnit: boolean
  iconUrl: string | null
  href: string
  count: number
  lowPrice: number | null
  artUrl?: string | null
}): RailCard {
  const { unitLabel } = input
  const base = {
    kind: 'currency' as const,
    name: unitLabel,
    href: input.href,
    image: input.iconUrl ? { src: input.iconUrl, alt: unitLabel } : null,
    art: input.artUrl ?? null,
    game: input.gameSlug,
    item: null,
    meta: null,
    categoryType: 'currency' as const,
  }
  if (!hasOffers(input.count, input.lowPrice)) {
    return { ...base, variant: 'sell', title: `Have ${unitLabel} to Sell?`, lines: [NO_SELLERS], summary: NO_SELLERS, cta: 'Sell', buyLabel: 'Sell' }
  }
  const per = !input.perUnit
    ? ''
    : input.granularity === 'thousand' ? ' per K' : input.granularity === 'million' ? ' per M' : ' each'
  const from = `${price(input.lowPrice)}${per}`
  // "Buy From $0.0052" alone could read as the whole price: say what it buys.
  const priced = !input.perUnit
    ? null
    : `Priced per ${input.granularity === 'thousand' ? 'K' : input.granularity === 'million' ? 'M' : unitLabel}`
  return {
    ...base,
    variant: 'buy',
    title: `Buy ${unitLabel}`,
    lines: priced ? [offersLabel(input.count), priced] : [offersLabel(input.count)],
    summary: `${offersLabel(input.count)} from ${from}`,
    cta: `Shop ${unitLabel}`,
    buyLabel: `Buy From ${price(input.lowPrice)}`,
  }
}

export function itemsCard(input: {
  gameSlug: string
  gameName: string
  href: string
  count: number
  lowPrice: number | null
  artUrl: string | null
}): RailCard {
  const name = `${input.gameName} Items`
  const base = {
    kind: 'items' as const,
    name,
    href: input.href,
    image: input.artUrl ? { src: input.artUrl, alt: name } : null,
    art: input.artUrl,
    game: input.gameSlug,
    item: null,
    meta: null,
    categoryType: 'items' as const,
  }
  if (!hasOffers(input.count, input.lowPrice)) {
    return { ...base, variant: 'sell', title: `Have ${name}?`, lines: [NO_SELLERS], summary: NO_SELLERS, cta: 'Sell', buyLabel: 'Sell' }
  }
  const summary = `${offersLabel(input.count)} from ${price(input.lowPrice)}`
  return { ...base, variant: 'buy', title: name, lines: [offersLabel(input.count)], summary, cta: 'Shop Items', buyLabel: `Buy From ${price(input.lowPrice)}` }
}

export function itemCard(input: {
  gameSlug: string
  itemSlug: string
  itemName: string
  imageUrl: string | null
  href: string
  count: number
  lowPrice: number | null
  deliveryLabel: string | null
  artUrl?: string | null
}): RailCard {
  const base = {
    kind: 'item' as const,
    name: input.itemName,
    href: input.href,
    image: input.imageUrl ? { src: input.imageUrl, alt: input.itemName } : null,
    art: input.artUrl ?? null,
    game: input.gameSlug,
    item: input.itemSlug,
    categoryType: 'items' as const,
  }
  if (!hasOffers(input.count, input.lowPrice)) {
    return { ...base, variant: 'sell', title: `Have ${article(input.itemName)}?`, lines: [NO_SELLERS], summary: NO_SELLERS, meta: null, cta: 'Sell', buyLabel: 'Sell' }
  }
  const summary = `${offersLabel(input.count)} from ${price(input.lowPrice)}`
  return {
    ...base,
    variant: 'buy',
    title: `Buy ${input.itemName}`,
    lines: [offersLabel(input.count)],
    summary,
    meta: input.deliveryLabel,
    cta: 'Buy Now',
    buyLabel: `Buy From ${price(input.lowPrice)}`,
  }
}

/**
 * Where "Sell" goes: the prefilled sell wizard for sellers, the open signup
 * flow for everyone else. Decided client-side from useAuth() — never on the
 * server, so the page stays static.
 */
export function sellHref(
  isSeller: boolean,
  target: { gameSlug: string; categoryType: 'currency' | 'items' },
  src: string,
): string {
  if (!isSeller) return foundingHref(src)
  const q = new URLSearchParams({ game: target.gameSlug, category: target.categoryType })
  return `/sell/new?${q.toString()}`
}

/** "20 Mins", "3 Hours", "Instant": the middle delivery promise of the offers. */
export function typicalDelivery(raw: ReadonlyArray<string | null | undefined>): string | null {
  const times = raw.filter((t): t is string => !!t && t.trim() !== '')
  if (times.length === 0) return null
  if (times.every((t) => t.trim().toLowerCase() === 'instant')) return 'Instant'
  const minutes = times.map((t) => parseDeliveryMinutes(t)).sort((a, b) => a - b)
  // The upper middle on an even count: the promise a buyer should plan for.
  const m = minutes[Math.floor(minutes.length / 2)]
  if (m < 60) return `${m} ${m === 1 ? 'Min' : 'Mins'}`
  if (m < 1440) {
    const h = Math.round(m / 60)
    return `${h} ${h === 1 ? 'Hour' : 'Hours'}`
  }
  const d = Math.round(m / 1440)
  return `${d} ${d === 1 ? 'Day' : 'Days'}`
}

/** Bar after a third of the page on blog posts ("scroll"), at once on item pages. */
export const BAR_SCROLL_THRESHOLD = 1 / 3

export function barVisible(s: {
  mode: 'immediate' | 'scroll'
  /** Share of the page scrolled, 0–1. */
  scrolled: number
  footerInView: boolean
  inputFocused: boolean
  dismissed: boolean
}): boolean {
  if (s.dismissed || s.footerInView || s.inputFocused) return false
  return s.mode === 'immediate' || s.scrolled >= BAR_SCROLL_THRESHOLD
}

export interface CalcItem {
  slug: string
  name: string
  variant?: string | null
}

/** The calculator box: "3 of 4 items in stock · Get them from $65". */
export function calcBuySummary(
  items: ReadonlyArray<CalcItem>,
  stock: Record<string, ItemStock | undefined>,
): { total: number; inStock: number; fromUsd: number; line: string; stocked: Array<CalcItem & { minUsd: number }> } | null {
  const stocked: Array<CalcItem & { minUsd: number }> = []
  for (const it of items) {
    const s = stock[it.slug]
    if (!s || s.total <= 0 || s.minPriceUsd == null) continue
    const own = it.variant ? s.byVariant[it.variant] : undefined
    stocked.push({ ...it, minUsd: own && own.count > 0 ? own.minPriceUsd : s.minPriceUsd })
  }
  if (stocked.length === 0) return null
  const fromUsd = Math.round(stocked.reduce((sum, i) => sum + i.minUsd, 0) * 100) / 100
  const total = items.length
  const noun = total === 1 ? 'item' : 'items'
  const them = stocked.length === 1 ? 'it' : 'them'
  return {
    total,
    inStock: stocked.length,
    fromUsd,
    line: `${stocked.length} of ${total} ${noun} in stock · Get ${them} from ${formatUsd(fromUsd)}`,
    stocked,
  }
}

/** The value-list card's buy line: "From $42", or null (the card shows "—"). */
export function listBuyLabel(stock: ItemStock | null | undefined): string | null {
  if (!stock || stock.total <= 0 || stock.minPriceUsd == null) return null
  return `From ${formatUsd(stock.minPriceUsd)}`
}

/** Whose currency the left rail sells: the game's own, Robux for Roblox games, else none. */
export function currencySourceSlug(game: { slug: string; ecosystem: string | null; hasCurrency: boolean }): string | null {
  if (game.hasCurrency) return game.slug
  return game.ecosystem === 'roblox' ? 'roblox' : null
}

/** Site-wide pick for posts with no game: the items category with the most live offers. */
export function busiestItemsGame(pages: ReadonlyArray<{ gameSlug: string; type: string | null; offers: number }>): string | null {
  let best: { gameSlug: string; offers: number } | null = null
  for (const p of pages) if (p.type === 'items' && (!best || p.offers > best.offers)) best = p
  return best?.gameSlug ?? null
}

/** The value item page's buy card, from the buy data the page already reads. */
export function valueItemRail(input: {
  gameSlug: string
  itemSlug: string
  itemName: string
  imageUrl: string | null
  artUrl?: string | null
  buy: { categorySlug: string; stock: ItemStock | null; offers: ReadonlyArray<{ deliveryTime?: string | null }> } | null
}): RailCard {
  const { buy } = input
  return itemCard({
    gameSlug: input.gameSlug,
    itemSlug: input.itemSlug,
    itemName: input.itemName,
    imageUrl: input.imageUrl,
    href: buy ? itemBuyHref({ gameSlug: input.gameSlug, categorySlug: buy.categorySlug, itemSlug: input.itemSlug }) : `/${input.gameSlug}`,
    count: buy?.stock?.total ?? 0,
    lowPrice: buy?.stock?.minPriceUsd ?? null,
    deliveryLabel: buy ? typicalDelivery(buy.offers.map((o) => o.deliveryTime)) : null,
    artUrl: input.artUrl ?? null,
  })
}

/** The phone bar's one card for a game: its items if they sell, else its currency, else the sell ask. */
export function barCard(rails: { items: RailCard | null; currency: RailCard | null }): RailCard | null {
  const { items, currency } = rails
  if (items?.variant === 'buy') return items
  if (currency?.variant === 'buy') return currency
  return items ?? currency
}
