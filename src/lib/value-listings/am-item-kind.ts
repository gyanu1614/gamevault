/**
 * Adopt Me sells eggs and potions as well as pets (owner, 2026-11-04). In the
 * catalogue they are `adopt_me_pets` rows with is_active = false and `item_kind`
 * set: the Values pages, the calculator, the sitemap, the blog and the crawlers
 * all read is_active rows, so they stay pets-only, while the market catalogue
 * reads every row the public can see. Their rarity column is a required
 * placeholder: the catalogue drops it.
 */
export type AmItemKind = 'egg' | 'potion'

/** The Items page's type tabs, in their order. */
export const AM_ITEM_TYPES = ['Pets', 'Eggs', 'Potions'] as const
export type AmItemType = (typeof AM_ITEM_TYPES)[number]

export function amItemType(kind: AmItemKind | null | undefined): AmItemType {
  return kind === 'egg' ? 'Eggs' : kind === 'potion' ? 'Potions' : 'Pets'
}

/** "Pets, Eggs & Potions". */
export function amTypesHeading(types: readonly string[]): string {
  if (types.length < 2) return types[0] ?? ''
  return `${types.slice(0, -1).join(', ')} & ${types[types.length - 1]}`
}
