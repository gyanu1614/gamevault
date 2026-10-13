import type { SellGameOption } from '@/lib/actions/sell-wizard'

/**
 * `/sell/new?game=<slug>&category=<slug>` — the wizard opens on that game's
 * offer details (the buy rails' "Sell" for sellers, growth point 2). Pure: the
 * page reads the params and the category's games, this picks the start. Any
 * miss starts the wizard empty, never an error.
 */
export interface WizardStart {
  categorySlug: string
  game: SellGameOption
}

const SLUG = /^[a-z0-9-]{1,80}$/

export function readWizardStartParams(q: { game?: unknown; category?: unknown }): { gameSlug: string; categorySlug: string } | null {
  if (typeof q.game !== 'string' || typeof q.category !== 'string') return null
  const gameSlug = q.game.trim().toLowerCase()
  const categorySlug = q.category.trim().toLowerCase()
  return SLUG.test(gameSlug) && SLUG.test(categorySlug) ? { gameSlug, categorySlug } : null
}

export function pickWizardStart(
  want: { gameSlug: string; categorySlug: string },
  categorySlugs: readonly string[],
  games: readonly SellGameOption[],
): WizardStart | null {
  if (!categorySlugs.includes(want.categorySlug)) return null
  const game = games.find((g) => g.game_slug === want.gameSlug)
  return game ? { categorySlug: want.categorySlug, game } : null
}
