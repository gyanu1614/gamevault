/**
 * Which games' items forms are derived from their values catalogue. Adding a
 * game = one config here, a dry run against prod, then the cutover run.
 */
import type { SellFormConfig } from './types'

export const MM2_SELL_FORM: SellFormConfig = {
  gameSlug: 'murder-mystery-2',
  typeField: 'item-type',
  typeFieldName: 'Item Type',
  types: [
    { key: 'knife', label: 'Knives', aliases: ['knife', 'knives'], listName: 'Knife Name' },
    { key: 'gun', label: 'Guns', aliases: ['gun', 'guns'], listName: 'Gun Name' },
    { key: 'pet', label: 'Pets', aliases: ['pet', 'pets'], listName: 'Pet Name' },
  ],
  rarities: ['Common', 'Uncommon', 'Rare', 'Legendary', 'Vintage', 'Godly', 'Ancient', 'Unique', 'Chroma'],
  // The 2026-10-09 copied lists and the 2026-10-13 hand-made rarity/name fields.
  legacyFields: [
    'select-knife', 'select-gun', 'select-pet',
    'rarity', 'rarity-2', 'rarity-3',
    'knife-name', 'knife-name-2', 'knife-name-3', 'knife-name-4', 'knife-name-5', 'knife-name-6',
    'gun-name', 'gun-name-2', 'gun-name-3', 'gun-name-4', 'gun-name-5',
  ],
}

export const SELL_FORM_CONFIGS: readonly SellFormConfig[] = [MM2_SELL_FORM]

export function findSellFormConfig(gameSlug: string): SellFormConfig | null {
  return SELL_FORM_CONFIGS.find((c) => c.gameSlug === gameSlug) ?? null
}

/** "Ancient" → "ancient", "Legendary Chroma" → "legendary-chroma"; the migration's slug style. */
export const raritySlug = (rarity: string) => rarity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const OTHER = 'other'
export const typeNode = (c: SellFormConfig) => c.typeField
export const rarityNode = (typeKey: string) => `rarity-${typeKey}`
export const listNode = (typeKey: string, rarity: string) => `${typeKey}-${rarity}`

/**
 * Every item-list field slug a config can produce (the value-link matcher
 * reads a listing's item from these keys, src/lib/value-listings/catalogs.ts).
 */
export function listFieldSlugs(c: SellFormConfig): string[] {
  const rarities = [...c.rarities.map(raritySlug), OTHER]
  return c.types.flatMap((t) => rarities.map((r) => listNode(t.key, r)))
}
