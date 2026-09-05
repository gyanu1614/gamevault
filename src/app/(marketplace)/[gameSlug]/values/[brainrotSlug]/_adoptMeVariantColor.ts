/**
 * Per-variant accent colours for Adopt Me — the single source shared by the pet
 * hero, the price-trend chart, and the values cards, so a variant reads the same
 * colour everywhere. Each of the 8 forms gets its OWN distinct hue spread across
 * the wheel (not three near-identical pinks) so the picker is legible at a
 * glance, and each colour carries meaning:
 *   N  grey       — plain, no potion
 *   F  sky blue   — flight = sky
 *   R  periwinkle — saddle, a cooler blue
 *   FR purple     — the trading benchmark
 *   NEON green    — the neon glow
 *   NFR orange    — hot, clearly apart from Neon/Mega
 *   MEGA hot pink — the loudest tier
 *   MFR gold      — top of the ladder
 */
export const VARIANT_COLOR: Record<string, string> = {
  N: '#9BA8A0',
  F: '#5AC8FA',
  R: '#7B9CFF',
  FR: '#B07BC9',
  NEON: '#3DE686',
  NFR: '#E0662E',
  MEGA: '#FF5CA8',
  MFR: '#F5C542',
}

export function variantColor(v: string): string {
  return VARIANT_COLOR[v] ?? '#B07BC9'
}
