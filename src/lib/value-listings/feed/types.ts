/**
 * The values feed: a values game's catalogue items as the MARKETPLACE sees
 * them (the game page's sections, the Items page grid), whatever shape the
 * game's value list has, plus DropMarket's own live stock per item. Never
 * another site's counts. Shared by features/game-home and features/items-grid.
 */

/** One value-list item. */
export interface FeedItem {
  slug: string
  name: string
  imageUrl: string | null
  /** The item's value page, or null when it has none. Marketplace UI never links it (values → market only). */
  href: string | null
  /** Rarity key as the game stores it (lib/values/rarity.ts maps label + colour), or null. */
  rarityKey: string | null
  /** Item type when the game has types (MM2: knife, gun, pet…), else null. */
  itemType: string | null
  /** The New badge rule (lib/values/new-item.ts), already applied by the list loader. */
  isNew: boolean
  /** 7-day % change, or null without two days of history. */
  trendPct: number | null
  /** The form the trend is for when the game prices forms ("FR"), else null. */
  trendLabel: string | null
  /** The item's headline value in USD: ordering and penny filtering only, never shown on marketplace cards. */
  valueUsd: number | null
}

/** One form (trait / mutation) of an item that we have in stock. */
export interface FormStock {
  /** The variant key in URLs ("neon-fly-ride"). */
  variant: string
  /** Its short label ("NFR"). */
  label: string
  count: number
  minPrice: number
}

/** A values game's feed: its items + OUR live stock per item. */
export interface ValuesFeed {
  items: FeedItem[]
  /** DropMarket's own live listings per item slug. */
  stock: Record<string, number>
  /** Our listings of an item (the item page), keyed by slug, only when in stock. */
  buyHref: Record<string, string>
  /** Our cheapest live price per item slug. */
  minPrice: Record<string, number>
  /** Short labels of the forms in stock per item slug ("FR", "NFR"; a mutation name elsewhere). */
  forms: Record<string, string[]>
  /** Per form in stock, cheapest first: the items grid's one-card-per-trait search. Absent on older fixtures. */
  formStock?: Record<string, FormStock[]>
  /** The items category slug the item pages live under ("buy-items"), or null when the game has none. */
  categorySlug: string | null
  /** When prices last changed, if the game's list reports it. */
  updatedAt: string | null
}
