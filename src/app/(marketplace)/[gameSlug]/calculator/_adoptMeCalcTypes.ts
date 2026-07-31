/**
 * Shared calculator types + constants — NO server imports, so client
 * components (_AdoptMeWflClient) can import these without dragging server-only
 * code into the client bundle. The server data loader lives in
 * _adoptMeCalcData.ts and imports FROM here.
 */

export const VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'] as const
export type Variant = (typeof VARIANTS)[number]

export const VARIANT_LABEL: Record<Variant, string> = {
  N: 'Normal',
  F: 'Fly',
  R: 'Ride',
  FR: 'Fly Ride',
  NEON: 'Neon',
  NFR: 'Neon Fly Ride',
  MEGA: 'Mega Neon',
  MFR: 'Mega Fly Ride',
}

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
