/**
 * Game home (/[gameSlug]) — one source of truth for what the loader returns
 * (GameHomeData) and what each section renders (GameHomeModel). A section
 * whose model is null is left out of the page; that is how a game without
 * values data, tools or guides gets a shorter page with no extra code.
 */
import type { HubCard, HubCategory, HubCategoryStat } from '@/app/(marketplace)/[gameSlug]/_hubModel'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import type { BlogRailPost } from '@/components/blog/BlogSection'
import type { HowItWorksHighlight } from '@/components/marketplace/HowItWorksBand'
import type { MoverRow } from './model/movers'
import type { ToolTile } from './model/tools'
import type { AboutRow } from './model/about'

export type { AboutRow, MoverRow, ToolTile }

export interface GameRow {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
}

export type { FeedItem, ValuesFeed } from '@/lib/value-listings/feed/types'
import type { FeedItem, ValuesFeed } from '@/lib/value-listings/feed/types'

export interface HotNewCard {
  slug: string
  name: string
  imageUrl: string | null
  /** Our live offers for it. */
  offers: number
  /** Our listings of it when in stock, else null (then the CTA is Sell Yours First). */
  buyHref: string | null
  /** Our cheapest live price when in stock. */
  fromPrice: number | null
}

export interface HotNewModel {
  title: string
  allHref: string
  sellHref: string
  cards: HotNewCard[]
}

export interface GameHomeData {
  game: GameRow
  categories: HubCategory[]
  /** One card per enabled category (buildHubCards), currency first. */
  cards: HubCard[]
  /** The currency card, when the game sells one. */
  spotlight: HubCard | null
  currency: { iconUrl: string | null; accent: string | null }
  /** Live count, cheapest price and average delivery per category id. */
  stats: Record<string, HubCategoryStat>
  offers: { items: ItemOffer[]; accounts: ItemOffer[] }
  faq: { q: string; a: string }[]
  /** Per-game trademark line under the payments strip. */
  trademark: string
  /** The game's values feed, or null for a game without a value list (or when it failed to load). */
  values: ValuesFeed | null
  /** Published posts tagged with the game, newest first (getBlogRail; DB rows carry their postType). */
  guides: (BlogRailPost & { postType?: string })[]
}

export interface HeaderModel {
  gameName: string
  gameImageUrl: string | null
  /** The item word for the seller prompt ("Got Adopt Me Pets to sell?"). */
  itemNoun: string
  /** "83 Adopt Me offers from $4.99, delivered in about 1 hour.", or null with no offers. */
  facts: string | null
}

export interface CurrencyModel {
  gameName: string
  name: string
  href: string
  iconUrl: string | null
  accent: string | null
  fromLabel: string | null
  avgDelivery: string | null
}

export interface OfferRowModel {
  title: string
  seeAllHref: string
  offers: ItemOffer[]
}

export interface PriceMovesModel {
  title: string
  listHref: string
  /** "Prices updated Oct 23" from real data, else "Updated daily". */
  updatedLabel: string
  rising: MoverRow[]
  falling: MoverRow[]
}

export interface ToolsModel {
  title: string
  tiles: ToolTile[]
  /** Up to two item pictures for the featured tile (the game's most valuable items), or []. */
  art: string[]
}

export interface GuideCard {
  href: string
  title: string
  excerpt: string
  cover: string | null
  readMinutes: number
  /** "Selling Guide", "Values", … from the post type. */
  typeLabel: string
  accent: string
}

export interface GuidesModel {
  title: string
  moreHref: string
  posts: GuideCard[]
}

export interface AboutModel {
  gameName: string
  gameImageUrl: string | null
  rows: AboutRow[]
  /** Up to 5 item pictures for the collage (most valuable items, else our offers). */
  art: string[]
  /** The game's categories as links with live counts, for the "what you can buy" art. */
  categories: { name: string; href: string; count: number }[]
}

export interface GameHomeModel {
  gameSlug: string
  gameName: string
  itemNoun: string
  itemNounSingular: string
  header: HeaderModel
  currency: CurrencyModel | null
  /** Top Selling rows: items, then accounts. Empty when the game has neither. */
  topSelling: OfferRowModel[]
  /** Hot New {Game} {Items}, or null without new items. */
  hotNew: HotNewModel | null
  /** The house How It Works bento: its H2 and the live figure on the first tile. */
  howItWorks: { title: string; highlight: HowItWorksHighlight | null }
  /** The house Why Buy card: live offers and the cheapest goods price ("$4.99"). */
  whyBuy: { count: number; fromPrice: string | null }
  /** Biggest Price Moves, or null for a game without trends. */
  priceMoves: PriceMovesModel | null
  /** Free {Game} Trading Tools, or null for a game without tool pages. */
  tools: ToolsModel | null
  /** {Game} Guides carousel, or null without published posts. */
  guides: GuidesModel | null
  about: AboutModel
  /** Product + AggregateOffer JSON-LD inputs for the item offers on the page, or null with none. */
  productSchema: { name: string; description: string; brand: string; lowPrice: number; highPrice: number; offerCount: number; image: string | null } | null
  faq: { q: string; a: string }[]
  trademark: string
}
