/**
 * Steal a Brainrot — mutation display system (single source of truth).
 *
 * Colors mirror each mutation's real in-game appearance so buyers recognize
 * them instantly. Used across the value directory, per-brainrot page, the cash
 * calculator, and marketplace so a mutation always looks the same everywhere.
 *
 * `order` controls display sequence (Default first, then roughly by how the
 * game presents rarity/impact). Keep this list in sync with `sab_mutations`.
 */

export type MutationVisual = {
  slug: string
  name: string
  /** Primary accent (text / border / dot). */
  color: string
  /** Soft translucent fill for chips/cards on the forest surface. */
  soft: string
  /** Optional gradient for mutations that are multi-colored in-game (Rainbow). */
  gradient?: string
  order: number
}

// In-game-accurate accents. `soft` is the same hue at low alpha for fills.
const MUTATIONS: MutationVisual[] = [
  { slug: 'default', name: 'Default', color: '#B7C0B2', soft: 'rgba(183,192,178,0.14)', order: 0 },
  { slug: 'gold', name: 'Gold', color: '#F5C542', soft: 'rgba(245,197,66,0.16)', order: 1 },
  { slug: 'diamond', name: 'Diamond', color: '#7FE3F0', soft: 'rgba(127,227,240,0.16)', order: 2 },
  { slug: 'candy', name: 'Candy', color: '#FF8FC5', soft: 'rgba(255,143,197,0.16)', order: 3 },
  { slug: 'lava', name: 'Lava', color: '#FF6A3D', soft: 'rgba(255,106,61,0.16)', order: 4 },
  { slug: 'radioactive', name: 'Radioactive', color: '#B6FF3C', soft: 'rgba(182,255,60,0.16)', order: 5 },
  { slug: 'galaxy', name: 'Galaxy', color: '#A98BFF', soft: 'rgba(169,139,255,0.18)', order: 6 },
  { slug: 'bloodrot', name: 'Bloodrot', color: '#E23B4E', soft: 'rgba(226,59,78,0.16)', order: 7 },
  { slug: 'cursed', name: 'Cursed', color: '#7A5CFF', soft: 'rgba(122,92,255,0.18)', order: 8 },
  { slug: 'cyber', name: 'Cyber', color: '#2DE1C2', soft: 'rgba(45,225,194,0.16)', order: 9 },
  { slug: 'phantom', name: 'Phantom', color: '#9AA7FF', soft: 'rgba(154,167,255,0.16)', order: 10 },
  { slug: 'divine', name: 'Divine', color: '#FFE9A3', soft: 'rgba(255,233,163,0.18)', order: 11 },
  {
    slug: 'yin-yang',
    name: 'Yin Yang',
    color: '#D8DEE9',
    soft: 'rgba(216,222,233,0.16)',
    order: 12,
  },
  {
    slug: 'rainbow',
    name: 'Rainbow',
    color: '#FF6FB5',
    soft: 'rgba(255,111,181,0.14)',
    gradient:
      'linear-gradient(90deg,#FF6B6B,#FFD166,#8AE234,#4CC9F0,#A98BFF,#FF6FB5)',
    order: 13,
  },
]

const BY_SLUG = new Map(MUTATIONS.map((m) => [m.slug, m]))

const FALLBACK: MutationVisual = {
  slug: 'unknown',
  name: 'Unknown',
  color: '#B7C0B2',
  soft: 'rgba(183,192,178,0.14)',
  order: 999,
}

/** Visual for a mutation slug; falls back to a neutral chip if unmapped. */
export function mutationVisual(slug: string | null | undefined): MutationVisual {
  if (!slug) return FALLBACK
  return BY_SLUG.get(slug) ?? { ...FALLBACK, name: slug }
}

/** Sort key for a mutation slug (lower = earlier). Unmapped sort last. */
export function mutationOrder(slug: string | null | undefined): number {
  return mutationVisual(slug).order
}

/**
 * Darken (amount<0) or lighten (amount>0) a #RRGGBB hex by a ratio in [-1,1].
 * Used for the 3D "pressed" bottom edge on mutation-colored buttons.
 */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp(((num >> 16) & 0xff) * (1 + amount))
  const g = clamp(((num >> 8) & 0xff) * (1 + amount))
  const b = clamp((num & 0xff) * (1 + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export { MUTATIONS }
