/**
 * Rarity → label + colour for every values hub. ONE map per game (it used to
 * be copied into six files and drifted). Plain module: safe for server and
 * client components.
 */

export interface RarityMeta {
  key: string
  label: string
  color: string
}

const FALLBACK = '#9BA8A0'

/** Steal a Brainrot — all eight rarities in the catalogue, rarest first. */
export const SAB_RARITIES: RarityMeta[] = [
  { key: 'Secret', label: 'Secret', color: '#E23B4E' },
  { key: 'Brainrot God', label: 'Brainrot God', color: '#FF8A3D' },
  { key: 'Mythic', label: 'Mythic', color: '#A98BFF' },
  { key: 'Legendary', label: 'Legendary', color: '#F5C542' },
  { key: 'Epic', label: 'Epic', color: '#7FE3F0' },
  { key: 'Rare', label: 'Rare', color: '#4FB477' },
  { key: 'Common', label: 'Common', color: '#9BA8A0' },
  { key: 'OG', label: 'OG', color: '#E7C6FF' },
]

/** Adopt Me — five tiers (DB keys are snake_case), rarest first. */
export const ADOPT_ME_RARITIES: RarityMeta[] = [
  { key: 'legendary', label: 'Legendary', color: '#F5C542' },
  { key: 'ultra_rare', label: 'Ultra-Rare', color: '#B07BC9' },
  { key: 'rare', label: 'Rare', color: '#4FB477' },
  { key: 'uncommon', label: 'Uncommon', color: '#7FE3F0' },
  { key: 'common', label: 'Common', color: '#9BA8A0' },
]

const BY_GAME: Record<string, RarityMeta[]> = {
  'steal-a-brainrot': SAB_RARITIES,
  'adopt-me': ADOPT_ME_RARITIES,
}

/** Rarities for a game, rarest first ([] when the game has none). */
export function raritiesFor(gameSlug: string): RarityMeta[] {
  return BY_GAME[gameSlug] ?? []
}

/** Label + colour for one rarity key; unknown keys keep their own text. */
export function rarityMeta(gameSlug: string, key: string | null | undefined): RarityMeta {
  const k = key ?? ''
  return raritiesFor(gameSlug).find((r) => r.key === k) ?? { key: k, label: k, color: FALLBACK }
}

/** Sort index (rarest = 0); unknown rarities sort last. */
export function rarityRank(gameSlug: string, key: string | null | undefined): number {
  const i = raritiesFor(gameSlug).findIndex((r) => r.key === key)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}
