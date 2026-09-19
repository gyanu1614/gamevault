/**
 * Shared types for the game-agnostic values pipeline.
 *
 * A "normaliser" is the only game-specific part of parsing: it turns one
 * marketplace listing title into a taxonomy match (or an explicit non-match).
 * Everything downstream — grouping, the reputable cheapest/average model,
 * publishing — is shared, which is what makes a new game a config plus one of
 * these modules rather than a second pipeline.
 */

/** What a listing is selling. Mirrors values_items.kind, plus non-item kinds. */
export type ListingIntent =
  | 'egg'
  | 'area'
  | 'pet'
  | 'item'
  | 'account'
  | 'currency'
  | 'service'
  | 'unknown'

/** One taxonomy entry the parser can match against. */
export interface TaxonomyEntry {
  id: string
  kind: 'egg' | 'area' | 'pet' | 'item' | 'account_bracket'
  slug: string
  name: string
  /** Extra spellings from values_item_aliases (listings misspell constantly). */
  aliases?: string[]
}

/** The result of parsing one listing title. */
export interface ParsedListing {
  intent: ListingIntent
  /** Matched taxonomy entry, when the parser is confident enough. */
  itemSlug: string | null
  /** 0..1. Callers persist this so a weak match can be reviewed, not trusted. */
  confidence: number
  /**
   * Units in the listing ("5x Random Egg" = 5). Price is divided by this to
   * reach a per-unit value; a bundle priced as one unit would otherwise look
   * like a 5x cheaper item.
   */
  quantity: number
  /** Income per second parsed from an account listing, else null. */
  incomePerSec: number | null
  /** Why the parser rejected or failed to match — drives the review file. */
  note?: string
}

/** A game's parsing strategy, selected by values_games.normaliser_key. */
export interface Normaliser {
  key: string
  parse(title: string, taxonomy: TaxonomyEntry[]): ParsedListing
}
