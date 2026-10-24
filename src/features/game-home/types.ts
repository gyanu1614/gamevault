/**
 * Game home (/[gameSlug]) — one source of truth for what the loader returns
 * (GameHomeData) and what each section renders (GameHomeModel). A section
 * whose model is null is left out of the page; that is how a game without
 * values data, tools or guides gets a shorter page with no extra code.
 */
import type { HubCard, HubCategory, HubCategoryStat } from '@/app/(marketplace)/[gameSlug]/_hubModel'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'

export interface GameRow {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
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
}

export interface HeroModel {
  gameName: string
  gameImageUrl: string | null
  /** "Buy and sell Adopt Me pets, accounts and more from verified sellers." */
  pitch: string
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

export interface GameHomeModel {
  gameSlug: string
  gameName: string
  itemNoun: string
  itemNounSingular: string
  hero: HeroModel
  currency: CurrencyModel | null
  /** Top Selling rows: items, then accounts. Empty when the game has neither. */
  topSelling: OfferRowModel[]
  /** True when the game has no enabled categories yet (Opening Soon). */
  openingSoon: boolean
  faq: { q: string; a: string }[]
  trademark: string
}
