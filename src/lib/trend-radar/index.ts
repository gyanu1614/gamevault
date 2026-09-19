/**
 * Trend radar — public surface for app code (routes, admin actions).
 * Import-free modules (roblox.ts, resolve.ts) are wired to the shared
 * matcher here; scripts import those modules directly.
 */
import { ACCEPT_THRESHOLD, decideMatch, scoreCandidate, searchRobloxGames } from '@/lib/games/icons'
import {
  resolveUniverse as resolveUniverseRaw,
  chooseUniverse as chooseUniverseRaw,
  type Matcher,
  type ResolveDeps,
  type UniverseChoice,
  type IconCandidate,
} from './resolve'

export const MATCHER: Matcher = { decideMatch, scoreCandidate, acceptThreshold: ACCEPT_THRESHOLD }

export function chooseUniverse(
  title: string,
  candidates: IconCandidate[],
  playingById: Map<number, number>,
): UniverseChoice | null {
  return chooseUniverseRaw(title, candidates, playingById, MATCHER)
}

export function resolveUniverse(
  title: string,
  deps: Omit<ResolveDeps, 'matcher' | 'search'> & { search?: ResolveDeps['search'] },
): Promise<UniverseChoice | null> {
  return resolveUniverseRaw(title, {
    search: deps.search ?? ((q) => searchRobloxGames(q)),
    playingById: deps.playingById,
    fetchPlaying: deps.fetchPlaying,
    matcher: MATCHER,
  })
}

export type { UniverseChoice }
export { DEFAULT_CONFIG, loadConfig, type TrendConfig } from './config'
export { evaluateSignals, type SignalEvent, type SignalInput, type TrendSignal } from './signals'
export {
  createPacer,
  fetchSorts,
  fetchGameMetrics,
  robloxGet,
  RobloxEndpointError,
  RobloxThrottleTripped,
  RADAR_SESSION_ID,
  METRICS_BATCH_SIZE,
  type Pacer,
  type Sorts,
  type SortGame,
  type GameMetricsRow,
  type EndpointHealth,
  type FetchLike,
} from './roblox'
export { parseSellerFeePage, chartGameNames, diffChart, matchChartName, ELDORADO_FEES_URL } from './eldorado'
export { draftTaxonomy, findWiki, type TaxonomyDraft } from './fandom'
export { slugFromTitle, resolveSlug, RADAR_CATEGORY_SLUGS } from './slug'
export {
  trendAlertPayload,
  markLive,
  liveFollowupPayload,
  postWebhook,
  patchWebhookMessage,
  type TrendAlertInput,
  type PostResult,
} from './discord'
