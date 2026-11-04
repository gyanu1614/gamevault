/**
 * GameWizard's per-category draft shape, the draft list it starts from, and the
 * defaults applied when a category is toggled on for the first time. No React here.
 */

import type { GameCategoryRow } from '@/lib/actions/admin-game-wizard'

export interface GlobalCategoryLite {
  id: string
  slug: string
  name: string
  icon_emoji: string | null
  is_active: boolean
  sort_order: number
}

export interface CategoryDraft {
  global_category_id: string
  slug: string
  name: string
  icon_emoji: string | null
  is_active: boolean
  is_enabled: boolean
  requires_region: boolean
  requires_platform: boolean
  available_regions: Array<{ code: string; name: string; currency?: string }>
  available_platforms: string[]
  delivery_modes: string[]
  // remember the original db row id, for upsert efficiency / debugging
  existing_id?: string
}

// ─── Defaults applied when toggling a category ON for the first time ─────────

function defaultsForCategory(slug: string): {
  delivery_modes: string[]
  requires_region: boolean
  requires_platform: boolean
} {
  switch (slug) {
    case 'currency':
    case 'items':
      // In-game currency/items must be transferred manually.
      return { delivery_modes: ['manual'], requires_region: false, requires_platform: false }
    case 'accounts':
      return { delivery_modes: ['manual', 'instant'], requires_region: false, requires_platform: false }
    case 'top-up':
      // Top-ups are region-sensitive (UC, Diamonds, Crystals all vary by region)
      return { delivery_modes: ['manual', 'instant'], requires_region: true, requires_platform: false }
    case 'boosting':
      return { delivery_modes: ['manual'], requires_region: false, requires_platform: false }
    default:
      return { delivery_modes: ['manual'], requires_region: false, requires_platform: false }
  }
}

/** One draft per global category, filled from the game's saved row when it has one. */
export function initialCategoryDrafts(
  globalCategories: GlobalCategoryLite[],
  initialGameCategories: GameCategoryRow[],
): CategoryDraft[] {
  return globalCategories.map((gc) => {
    const existing = initialGameCategories.find((r) => r.global_category_id === gc.id)
    if (existing) {
      return {
        global_category_id: gc.id,
        slug: gc.slug,
        name: gc.name,
        icon_emoji: gc.icon_emoji,
        is_active: gc.is_active,
        is_enabled: existing.is_enabled,
        requires_region: existing.requires_region,
        requires_platform: existing.requires_platform,
        available_regions: existing.available_regions ?? [],
        available_platforms: existing.available_platforms ?? [],
        delivery_modes: existing.delivery_modes ?? ['manual'],
        existing_id: existing.id,
      }
    }
    const d = defaultsForCategory(gc.slug)
    return {
      global_category_id: gc.id,
      slug: gc.slug,
      name: gc.name,
      icon_emoji: gc.icon_emoji,
      is_active: gc.is_active,
      is_enabled: false,
      requires_region: d.requires_region,
      requires_platform: d.requires_platform,
      available_regions: [],
      available_platforms: [],
      delivery_modes: d.delivery_modes,
    }
  })
}
