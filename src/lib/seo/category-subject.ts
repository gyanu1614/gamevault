/**
 * What a category page is about, in the words people search. A currency
 * category is stored as "Currency", but nobody searches "buy escape from
 * tarkov currency"; they search "buy tarkov roubles" / "buy eft roubles"
 * (GSC 2026-10-15: 500+ impressions at position ~80, title never said
 * roubles). The title, description and keywords all build on this.
 */
import { currencyUnitLabel } from '@/lib/categories/currency-nav-label'

/** Short names players search with, where the full game name is not what they type. */
const GAME_SEARCH_ALIASES: Record<string, string> = {
  'escape-from-tarkov': 'EFT',
}

export interface CategorySubject {
  /** "Escape from Tarkov Roubles" */
  subject: string
  /** "EFT", when players search a short name */
  alias: string | null
  /** "PvP or PvE", when the currency is sold per play mode */
  modes: string | null
}

export function categorySubject(input: {
  gameName: string
  gameSlug: string
  categoryName: string
  isCurrency: boolean
  unitLabel?: string | null
  regionOptions?: string[]
}): CategorySubject {
  const unit = input.isCurrency ? currencyUnitLabel(input.unitLabel) : null
  const noun = unit ?? input.categoryName
  const subject = noun.toLowerCase().includes(input.gameName.toLowerCase()) ? noun : `${input.gameName} ${noun}`
  const opts = input.regionOptions ?? []
  const modes = opts.some((o) => /pvp/i.test(o)) && opts.some((o) => /pve/i.test(o)) ? 'PvP or PvE' : null
  return { subject, alias: GAME_SEARCH_ALIASES[input.gameSlug] ?? null, modes }
}
