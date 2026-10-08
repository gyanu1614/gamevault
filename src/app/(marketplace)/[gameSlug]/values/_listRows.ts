import 'server-only'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { valueListHub } from '@/lib/values/hub-config'
import { getAdoptMePets } from './_adoptMeData'
import { getSabBrainrots } from './_sabBrainrots'
import { getValueListRows } from './_generic/valueListRows'

/**
 * Which value list a game's /values page renders — the same dispatch as
 * values/page.tsx — and its full rows for `/[game]/values/rows.json`
 * (contract: lib/values/lazy-list.ts). A new game on the generic template
 * (VALUES_PIPELINE_GAMES + a VALUE_LIST_HUBS entry) is covered with no code.
 */
export type ValueListKind = 'adopt-me' | 'steal-a-brainrot' | 'generic'

export function valueListKind(gameSlug: string): ValueListKind | null {
  if (!hasHubPage(gameSlug, 'values')) return null
  if (gameSlug === 'adopt-me') return 'adopt-me'
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) return valueListHub(gameSlug) ? 'generic' : null
  if (gameSlug === 'steal-a-brainrot') return 'steal-a-brainrot'
  return null
}

/** Every game with a lazy value list (rows.json's prerender set). */
export function valueListGames(): string[] {
  return contentHubSlugsFor('values').filter((g) => valueListKind(g) != null)
}

export async function loadValueListRows(gameSlug: string): Promise<unknown[] | null> {
  switch (valueListKind(gameSlug)) {
    case 'adopt-me':
      return getAdoptMePets()
    case 'steal-a-brainrot':
      return getSabBrainrots()
    case 'generic':
      return (await getValueListRows(gameSlug)).rows
    default:
      return null
  }
}
