/**
 * Shared calculator types + constants — NO server imports, so client
 * components (_AdoptMeWflClient) can import these without dragging server-only
 * code into the client bundle. The server data loader lives in
 * _adoptMeCalcData.ts and imports FROM here.
 */

// The variant axis moved to @/lib/adopt-me/variants (Step 4): the bulk importer
// needs it too, and a route-private module is the wrong home for data the DB
// stores. Re-exported so every existing importer of this file is unchanged.
export { VARIANTS, VARIANT_LABEL, type Variant } from '@/lib/adopt-me/variants'
// A re-export does not bind the name locally; the interfaces below need it.
import type { Variant } from '@/lib/adopt-me/variants'

export interface CalcVariantValue {
  tradeValue: number | null
  cashUsd: number | null
  isEstimated: boolean
}

export interface CalcPet {
  slug: string
  name: string
  rarity: string
  imageUrl: string | null
  /** variant code → its values (may be absent for un-priced variants). */
  values: Partial<Record<Variant, CalcVariantValue>>
}
