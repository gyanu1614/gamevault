

// ─── Constants ───────────────────────────────────────────────────────────────

export const STEPS = [
  { id: 1, label: 'Category', hint: 'Choose A Category' },
  { id: 2, label: 'Game',     hint: 'Choose A Game' },
  { id: 3, label: 'Details',  hint: 'Offer Details' },
] as const

export const RECENT_GAMES_KEY = 'gv_sell_recent_games'
// R16 — sessionStorage key for the wizard snapshot so refresh keeps the
// seller on the same step with the same draft. Lives on sessionStorage so it
// auto-clears when the tab closes (we don't want a stale half-filled draft
// to come back days later).
export const WIZARD_SNAPSHOT_KEY = 'gv_sell_wizard_snapshot'

export interface WizardSnapshot {
  step: number
  categoryId: string | null
  gameId: string | null
  region: string
  platform: string
  // V19/P24/P3 — Bundle id for fixed-bundle currency listings.
  // Optional so old snapshots still parse.
  bundleId?: string
  deliveryMethodType?: string
  title: string
  description: string
  price: string
  originalPrice: string
  quantity: string
  minQuantity: string
  deliveryMethod: 'manual' | 'instant'
  deliveryTime: string
  images: string[]
  fieldValues: Record<string, unknown>
  agreeSellerRules: boolean
  agreeTos: boolean
}
