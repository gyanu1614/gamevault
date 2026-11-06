import { variantLabel, variantShortCode, type LoadedCatalog } from '@/lib/value-listings/catalogs'
import { mutationVisual, type MutationVisual } from '@/lib/sab/mutations'
import type { TraitDef } from './offers'

export type TraitTone = 'neon' | 'mega' | 'chroma' | null

/**
 * How a trait's name is coloured (Skinport names StatTrak / Souvenir in
 * colour; we do the same for the special forms): Adopt Me Neon green, Mega
 * rainbow; Murder Mystery 2's Chroma version in the Values pages' chroma finish.
 */
export function traitTone(key: string | null): TraitTone {
  if (!key) return null
  if (key.startsWith('chroma-')) return 'chroma'
  if (key.startsWith('mega')) return 'mega'
  if (key.startsWith('neon')) return 'neon'
  return null
}

/** A Steal a Brainrot mutation's look, the same everywhere: Candy pink, Lava red. Default has none. */
export function traitMutation(key: string | null): MutationVisual | null {
  if (!key || key === 'default') return null
  const visual = mutationVisual(key)
  return visual.slug === 'unknown' ? null : visual
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
