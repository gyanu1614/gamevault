import { variantLabel, variantShortCode, type LoadedCatalog } from '@/lib/value-listings/catalogs'
import type { TraitDef } from './offers'

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
