import { variantLabel, variantShortCode, type LoadedCatalog } from '@/lib/value-listings/catalogs'
import type { TraitDef, TraitOption } from './offers'

export type TraitTone = 'neon' | 'mega' | 'gold' | 'diamond' | null

/**
 * How a trait's name is coloured (Skinport names StatTrak / Souvenir in
 * colour; we do the same for the special forms): Adopt Me Neon green, Mega
 * rainbow; Steal a Brainrot Gold, Diamond and Rainbow mutations likewise.
 */
export function traitTone(key: string | null): TraitTone {
  if (!key) return null
  if (key.startsWith('mega') || key === 'rainbow') return 'mega'
  if (key.startsWith('neon')) return 'neon'
  if (key === 'gold') return 'gold'
  if (key === 'diamond') return 'diamond'
  return null
}

/**
 * A game's traits for the pet page's picker, in catalogue order: SAB's
 * "Default" (no mutation) first, then each mutation; Adopt Me's eight potion
 * forms with their trade shorthand. Empty for a game without variants.
 */
export function traitDefs(gameSlug: string, loaded: LoadedCatalog): TraitDef[] {
  const { catalog, mutations } = loaded
  const keys = [...(catalog.defaultVariant ? [catalog.defaultVariant] : []), ...catalog.variants.map((v) => v.key)]
  return keys.map((key) => ({
    key,
    label: variantLabel(gameSlug, key, mutations) ?? key,
    short: variantShortCode(gameSlug, key),
  }))
}

/**
 * How the buy column offers the traits: Adopt Me's forms as a grid of badge
 * tiles, each with its price (StockX's size grid, the game's own badges);
 * anything else — mutations have long names and no badges — in the dropdown.
 */
export function traitPicker(options: readonly Pick<TraitOption, 'short'>[]): 'tiles' | 'dropdown' | 'none' {
  if (options.length === 0) return 'none'
  const plain = options.filter((o) => !o.short).length
  return options.length <= 8 && plain <= 1 ? 'tiles' : 'dropdown'
}
