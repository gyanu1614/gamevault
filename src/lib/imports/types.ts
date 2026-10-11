/**
 * Step 4 bulk importer — the contract every game satisfies.
 *
 * The importer itself knows nothing about brainrots, pets or eggs. Each game
 * contributes ONE config module (src/lib/imports/config/<game>.ts) that says
 * where its catalogue lives, what its variant axis is, where its market prices
 * are, and how a listing's title and description read. Adding a game is that
 * file plus a registry line — no new tables, no new matching, no route edits.
 *
 * Plain types + plain functions: the config modules do their reads through an
 * injected client so every piece is unit-testable without a database.
 */
import type { DeliveryMethod } from '@/lib/listings/validate'
import type { VariantStyle } from './copy'

/** The slice of a Supabase client a config's loaders need (read-only). */
export interface ImportReader {
  from(table: string): any
}

/**
 * Facts a description template may state. Every field is something the
 * catalogue actually holds — the templates never invent, and a missing fact
 * drops its sentence rather than guessing.
 */
export interface ItemFacts {
  rarity?: string | null
  /** How the item is obtained, in the game's own words ("Jungle Egg"). */
  obtainedFrom?: string | null
  /** Games with an income stat (SAB, Steal An Egg). */
  incomePerSec?: number | null
  /** Biome / area the item belongs to. */
  area?: string | null
  /** The catalogue's own classification, where it has one. */
  kind?: string | null
}

/** One catalogue entry an input row can resolve to. */
export interface CatalogueItem {
  /**
   * Stable key: the catalogue row's slug. Stored on the listing as
   * `import_item_ref` and is half the re-import idempotency key, so it must
   * never be a display string or a uuid that changes between environments.
   */
  ref: string
  name: string
  /**
   * Spellings the game's own alias table already knows. The importer also
   * consults listing_import_aliases for supplier-specific spellings.
   */
  aliases: string[]
  facts: ItemFacts
  /** The catalogue's image, if it has one. Absent for most games today. */
  imageUrl: string | null
}

/** One value on the game's variant axis (an SAB mutation, an Adopt Me variant). */
export interface CatalogueVariant {
  /** Stored on the listing as `import_variant`. */
  ref: string
  /** How it reads in a title ("Neon Fly Ride", "Gold"). */
  label: string
  /**
   * One factual line saying what this variant IS, shown in the description
   * ("Neon Fly Ride (NFR): a glowing Neon that can fly and be ridden."). Real
   * game mechanics only — the loader supplies it from data or a fixed table.
   */
  note?: string | null
}

export interface ImportCatalogue {
  items: CatalogueItem[]
  /** Empty array = this game has no variant axis (Steal An Egg eggs). */
  variants: CatalogueVariant[]
}

export interface MarketPrice {
  usd: number
  /**
   * The number is DERIVED rather than observed from live listings — Adopt Me's
   * launch values (`adopt_me_pet_values.is_estimated`) and SAB's
   * `is_public_estimate` rows are both marked this way, and the values pages
   * label them as estimates.
   *
   * An `auto`-priced row refuses an estimated price unless the batch opts in,
   * so "never invent a price" holds by default instead of by good intentions.
   */
  estimated: boolean
  /** How many live listings backed it, where the source records that. */
  sampleSize?: number | null
}

/**
 * Market prices keyed by `priceKey(itemRef, variantRef)`.
 * A missing key means "no market price": an `auto` row is rejected rather
 * than priced from a guess.
 */
export type MarketPriceMap = ReadonlyMap<string, MarketPrice>

/** One key shape for the price map, so loaders and readers cannot disagree. */
export function priceKey(itemRef: string, variantRef: string | null): string {
  return `${itemRef}\u0000${variantRef ?? ''}`
}

/** What a title / description template is given. */
export interface CopyContext {
  item: CatalogueItem
  /** null when the game has no variant axis, or the row named no variant. */
  variant: CatalogueVariant | null
  gameName: string
}

export interface GameImportConfig {
  /** `games.slug`. The registry key. */
  gameSlug: string
  /**
   * The GLOBAL category slug ('items', 'accounts', …) — what
   * `findEnabledGameCategory` takes. It resolves to this game's own pair
   * (`buy-items`), so the pair must be enabled in admin before a batch applies.
   */
  categorySlug: string
  /** Singular noun for the admin UI ("pet", "brainrot", "egg"). */
  itemNoun: string
  /** Singular noun for the variant axis, or null when there is none. */
  variantNoun: string | null
  /**
   * How this game writes its variant in copy. 'code' when the stored ref is the
   * short form players search ('FR'); 'label' when the ref is a slug and the
   * name is what belongs in a title.
   */
  variantStyle: VariantStyle
  /**
   * Delivery the imported listings promise. `window` must be one of
   * SELLER_DELIVERY_WINDOWS — free text breaks the SLA and cancellation
   * parsers, and the shared validator rejects it.
   */
  delivery: { method: DeliveryMethod; window: string }
  /**
   * Fandom host for item art, e.g. 'adoptme.fandom.com'. Tried when the
   * catalogue has no image. Omit for a game with no wiki worth reading.
   */
  wikiHost?: string
  /** Used only when neither the catalogue nor the wiki has an image. */
  placeholderImage: string
  /**
   * Fixed values for the game's filter attributes that every imported listing
   * carries, keyed by attribute NAME or slug, e.g. `{ 'item type': 'Pets' }`.
   * Matched against the live attribute template at import time; a value that is
   * not one of the attribute's options is ignored, never invented. The variant
   * is mapped separately and automatically.
   */
  attributeHints?: Record<string, string>
  loadCatalogue(client: ImportReader, gameId: string): Promise<ImportCatalogue>
  loadMarketPrices(client: ImportReader, gameId: string): Promise<MarketPriceMap>
  /** ≤ 100 chars (TITLE_MAX) and ≥ 5 (TITLE_MIN); the validator enforces both. */
  title(ctx: CopyContext): string
  /** ≤ 5000 chars (DESCRIPTION_MAX). Facts only — the copy guard applies. */
  description(ctx: CopyContext): string
}
