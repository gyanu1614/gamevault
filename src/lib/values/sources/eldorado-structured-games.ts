/**
 * Per-game config for the `eldorado-structured` normaliser.
 *
 * Eldorado exposes STRUCTURED identity on some games' offers
 * (`tradeEnvironmentValues`: Item type / Rarity / Item name, plus a variant
 * attribute) — unlike Steal an Egg, whose offers carry nothing and must be
 * parsed from titles. For those games a new hub is one entry here + a
 * values_games seed row + a catalogue import; the collector, normaliser,
 * importer and pricing are shared.
 *
 * Kept free of `@/` imports and TS-only runtime syntax: the collector scripts
 * load it through tsx, and a guard pins `gameId` to the values_games seed.
 */

export interface EldoradoStructuredVariantConfig {
  /** `offer.attributes[].id` carrying the variant (MM2: `mm2-properties`). */
  attributeId: string
  /** Raw attribute value → our variant key. Values not listed fall back to the title. */
  map: Readonly<Record<string, string>>
  /** The variant a listing has when nothing says otherwise. */
  defaultVariant: string
  /** Title words that EXPLICITLY name a non-default variant (title fallback). */
  titlePatterns: Readonly<Record<string, RegExp>>
}

export interface EldoradoStructuredConfig {
  /** Our game slug (/<gameSlug>/values). */
  gameSlug: string
  /** Eldorado `gameId` (offers API). */
  gameId: string
  /** Eldorado offers category. */
  category: 'CustomItem'
  /** `tradeEnvironmentValues[].name` for each identity field. */
  identity: {
    type: string
    name: string
    rarity: string
  }
  /**
   * Eldorado item type → our values_items.item_type. A type mapped to null is
   * not a catalogue item (services, VIP servers, "Other") and is rejected —
   * kept in the raw table for review, never priced.
   */
  typeMap: Readonly<Record<string, string | null>>
  /** Item-name values that are placeholders, not items ("Other"). */
  rejectNames: readonly string[]
  variant?: EldoradoStructuredVariantConfig
  /**
   * Below this a price is a per-in-game-unit bait listing (MM2: a VIP server
   * at $0.00001 × 5.3M stock), not a unit price. Real MM2 commons clear at
   * ~$0.05.
   */
  minUnitUsd: number
  /** Full crawl size guard: refuse a feed that walked fewer pages than this share of totalPages. */
  minCompleteShare: number
}

export const ELDORADO_STRUCTURED_GAMES: Readonly<Record<string, EldoradoStructuredConfig>> = Object.freeze({
  'murder-mystery-2': {
    gameSlug: 'murder-mystery-2',
    gameId: '204',
    category: 'CustomItem',
    identity: { type: 'Item type', name: 'Item name', rarity: 'Rarity' },
    // Verified on 14,525 live offers (2026-10-04): Knife 7,407 · Gun 4,227 ·
    // Pet 928 · Misc 66 · Other 1,885 (VIP servers, sets, unstructured).
    typeMap: { Knife: 'knife', Gun: 'gun', Pet: 'pet', Misc: 'misc', Other: null },
    rejectNames: ['Other'],
    variant: {
      attributeId: 'mm2-properties',
      map: { Common: 'default', Chroma: 'chroma' },
      defaultVariant: 'default',
      // \b keeps "Chromatic" (a real knife/gun) from reading as chroma.
      titlePatterns: { chroma: /\bchroma\b/i },
    },
    minUnitUsd: 0.01,
    minCompleteShare: 0.9,
  },
  // Blox Fruits next: add its entry here (Eldorado gameId + identity names +
  // typeMap), seed its values_games row, import its catalogue. No new code.
})

export function eldoradoStructuredConfig(gameSlug: string): EldoradoStructuredConfig | null {
  return ELDORADO_STRUCTURED_GAMES[gameSlug] ?? null
}
