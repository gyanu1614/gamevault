/**
 * Client-safe shapes for the Adopt Me pet page. `_adoptMePetData` is
 * `server-only`, so 'use client' components import these instead (never even
 * a type from the server module). Structurally identical to the loader's rows.
 */
import type { Variant } from '../../calculator/_adoptMeCalcTypes'

export interface AdoptMePetVariant {
  variant: Variant
  label: string
  tradeValue: number | null
  /** Headline cash = reputable market (average) when present, else legacy value. */
  cashUsd: number | null
  /** Lowest reputable-seller price (100+ reviews). Null until priced. */
  cheapestUsd: number | null
  /** Reputable market price (median of cheapest reputable listings). */
  averageUsd: number | null
  isEstimated: boolean
  confidence: string
  listingsTracked: number
  /** When this variant was last repriced (ISO), for the freshness badge. */
  lastPricedAt: string | null
}

/** One daily price point for the trend chart. */
export interface PetPricePoint {
  date: string
  price: number
}
