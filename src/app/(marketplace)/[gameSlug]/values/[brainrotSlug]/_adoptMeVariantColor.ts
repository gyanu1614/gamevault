/**
 * Per-variant accent colours for Adopt Me — the single source shared by the pet
 * hero and the price-trend chart so a variant reads the same colour everywhere.
 * Neon/Mega tiers run "hotter" (pink/gold); the base forms stay cool.
 */
export const VARIANT_COLOR: Record<string, string> = {
  N: '#9BA8A0',
  F: '#7FE3F0',
  R: '#7FB0F0',
  FR: '#B07BC9',
  NEON: '#E86FD0',
  NFR: '#D66FE8',
  MEGA: '#F5A742',
  MFR: '#F5C542',
}

export function variantColor(v: string): string {
  return VARIANT_COLOR[v] ?? '#B07BC9'
}
