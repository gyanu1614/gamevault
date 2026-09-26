/**
 * Roblox keyless endpoints for the trend radar. Pure parsing + IO with an
 * injectable fetch, in the style of lib/games/icons.ts.
 *
 * Endpoints (all verified live 2026-09-18, no credentials):
 *
 *  discovery  GET apis.roblox.com/explore-api/v1/get-sorts
 *               ?sessionId=<opaque>&device=computer&country=all
 *             One call returns `top-playing-now` (~97 games), `top-trending`
 *             (~96) and `up-and-coming` (~28) with universeId, rootPlaceId,
 *             name, playerCount, votes, isSponsored. No pagination needed.
 *  fallback   GET apis.roblox.com/explore-api/v1/get-sort-content
 *               ?sessionId=<opaque>&sortId=top-playing-now&device=computer&country=all
 *             Same family, different endpoint, single sort. Used only when
 *             get-sorts fails or answers without a top-playing-now sort.
 *             (games.roblox.com/v1/games/sorts and /games/list?sortToken are
 *             BOTH dead — 404 {"errors":[{"code":0}]} — so the legacy
 *             sortToken path documented elsewhere cannot be a fallback.)
 *  metrics    GET games.roblox.com/v1/games?universeIds=a,b,c
 *             playing / visits / favoritedCount / created. Hard limit of
 *             50 ids per call (51 → 400 "Too many universe IDs").
 *
 * sessionId: the explore API requires a sessionId (400 without one) but
 * treats it as an opaque client session token — any string works and it is
 * not validated. We send the constant RADAR_SESSION_ID so Roblox sees one
 * stable, identifiable client rather than a fresh "user" per run.
 *
 * Rate limit: ~9 rapid calls earn a 429 that the x-ratelimit-* headers do
 * not predict (they still showed 288/300 remaining), and it clears in ~2 min.
 * So: a hard 1 req/s cap with jitter (createPacer), Retry-After honoured on
 * the FIRST 429, and a circuit breaker that ends the run on the SECOND —
 * retrying through a throttle only lengthens the ban.
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export const RADAR_SESSION_ID = 'dropmarket-radar'
export const METRICS_BATCH_SIZE = 50

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

const EXPLORE_BASE = 'https://apis.roblox.com/explore-api/v1'
const GAMES_BASE = 'https://games.roblox.com/v1/games'

// ── types ──────────────────────────────────────────────────────────────────

export interface SortGame {
  universeId: number
  rootPlaceId: number
  name: string
  playerCount: number
  isSponsored: boolean
  upVotes: number
  downVotes: number
}

export interface SortLists {
  topPlayingNow: SortGame[]
  topTrending: SortGame[]
  upAndComing: SortGame[]
}

export type SortsEndpoint = 'get-sorts' | 'get-sort-content'

export interface Sorts extends SortLists {
  endpoint: SortsEndpoint
}

export interface GameMetricsRow {
  universeId: number
  rootPlaceId: number
  name: string
  playing: number
  visits: number
  favorites: number
  created: string | null
}

export interface EndpointAttempt {
  endpoint: string
  status: number | null
  error?: string
}

/** What gets written to trend_events.flags when a collection run cannot proceed. */
export interface EndpointHealth {
  endpoint: string
  status: number | null
  fallbackTried: boolean
  attempts: EndpointAttempt[]
  error?: string
}

// ── errors ─────────────────────────────────────────────────────────────────

/** Second 429 of the run: stop cleanly, do not retry through the throttle. */
export class RobloxThrottleTripped extends Error {
  readonly hits: number
  // No parameter properties: this module is loaded by Node's type-stripper
  // (scripts/backfill-game-external-ids.mjs), which rejects that syntax.
  constructor(hits: number) {
    super(`Roblox throttle tripped after ${hits} rate-limit responses; ending run`)
    this.name = 'RobloxThrottleTripped'
    this.hits = hits
  }
}

/** An endpoint answered with something the radar cannot use. */
export class RobloxEndpointError extends Error {
  readonly health: EndpointHealth
  constructor(health: EndpointHealth) {
    super(`roblox ${health.endpoint} failed (${health.status ?? 'network'})`)
    this.name = 'RobloxEndpointError'
    this.health = health
  }
}

// ── pure: parsing ──────────────────────────────────────────────────────────

type RawSortGame = {
  universeId?: number
  rootPlaceId?: number
  name?: string
  playerCount?: number
  isSponsored?: boolean
  totalUpVotes?: number
  totalDownVotes?: number
}

function toSortGame(g: RawSortGame): SortGame | null {
  if (typeof g.universeId !== 'number' || typeof g.name !== 'string') return null
  if (g.isSponsored) return null
  return {
    universeId: g.universeId,
    rootPlaceId: typeof g.rootPlaceId === 'number' ? g.rootPlaceId : 0,
    name: g.name,
    playerCount: typeof g.playerCount === 'number' ? g.playerCount : 0,
    isSponsored: false,
    upVotes: typeof g.totalUpVotes === 'number' ? g.totalUpVotes : 0,
    downVotes: typeof g.totalDownVotes === 'number' ? g.totalDownVotes : 0,
  }
}

function gamesOf(games: unknown): SortGame[] {
  if (!Array.isArray(games)) return []
  return (games as RawSortGame[]).map(toSortGame).filter((g): g is SortGame => g !== null)
}

export function parseSortsResponse(body: unknown): SortLists {
  const out: SortLists = { topPlayingNow: [], topTrending: [], upAndComing: [] }
  const sorts = (body as { sorts?: { sortId?: string; contentType?: string; games?: unknown }[] })?.sorts
  if (!Array.isArray(sorts)) return out
  for (const s of sorts) {
    if (s.contentType && s.contentType !== 'Games') continue
    if (s.sortId === 'top-playing-now') out.topPlayingNow = gamesOf(s.games)
    else if (s.sortId === 'top-trending') out.topTrending = gamesOf(s.games)
    else if (s.sortId === 'up-and-coming') out.upAndComing = gamesOf(s.games)
  }
  return out
}

export function parseSortContentResponse(body: unknown): SortGame[] {
  return gamesOf((body as { games?: unknown })?.games)
}

export function parseGamesBatch(body: unknown): GameMetricsRow[] {
  const data = (body as { data?: Record<string, unknown>[] })?.data
  if (!Array.isArray(data)) return []
  const rows: GameMetricsRow[] = []
  for (const g of data) {
    if (typeof g.id !== 'number') continue
    rows.push({
      universeId: g.id,
      rootPlaceId: typeof g.rootPlaceId === 'number' ? g.rootPlaceId : 0,
      name: typeof g.name === 'string' ? g.name : '',
      playing: typeof g.playing === 'number' ? g.playing : 0,
      visits: typeof g.visits === 'number' ? g.visits : 0,
      favorites: typeof g.favoritedCount === 'number' ? g.favoritedCount : 0,
      created: typeof g.created === 'string' ? g.created : null,
    })
  }
  return rows
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// ── pacing + circuit breaker ───────────────────────────────────────────────

export interface Pacer {
  /** Block until the next call is allowed (min interval + jitter). */
  wait(): Promise<void>
  /** Record a 429. Throws RobloxThrottleTripped once `maxRateLimitHits` is reached. */
  record429(): void
  readonly rateLimitHits: number
  sleep(ms: number): Promise<void>
}

export interface PacerOptions {
  minIntervalMs?: number
  jitterMs?: number
  maxRateLimitHits?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * One pacer per run, shared by every Roblox call in it. Defaults enforce the
 * hard 1 req/s cap (+0–250 ms jitter) and trip on the second 429.
 */
export function createPacer(opts: PacerOptions = {}): Pacer {
  const {
    minIntervalMs = 1000,
    jitterMs = 250,
    maxRateLimitHits = 2,
    now = () => Date.now(),
    sleep = realSleep,
    random = Math.random,
  } = opts
  let last: number | null = null
  let hits = 0
  return {
    get rateLimitHits() {
      return hits
    },
    sleep,
    async wait() {
      const t = now()
      if (last !== null) {
        const due = last + minIntervalMs + Math.floor(random() * jitterMs)
        if (due > t) await sleep(due - t)
      }
      last = now()
    },
    record429() {
      hits += 1
      if (hits >= maxRateLimitHits) throw new RobloxThrottleTripped(hits)
    },
  }
}

export interface RobloxDeps {
  fetchImpl?: FetchLike
  pacer: Pacer
}

/**
 * Paced GET. On a 429: record it (may trip), then wait Retry-After (or 2 s)
 * and retry once. A second 429 anywhere in the run throws from record429.
 */
export async function robloxGet(url: string, deps: RobloxDeps): Promise<Response> {
  const { fetchImpl = fetch, pacer } = deps
  const init: RequestInit = { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }

  await pacer.wait()
  let res = await fetchImpl(url, init)
  if (res.status !== 429) return res

  pacer.record429()
  const retryAfter = Number(res.headers.get('retry-after') ?? '')
  await pacer.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000)

  await pacer.wait()
  res = await fetchImpl(url, init)
  if (res.status === 429) pacer.record429()
  return res
}

// ── IO: discovery ──────────────────────────────────────────────────────────

function exploreUrl(path: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ sessionId: RADAR_SESSION_ID, device: 'computer', country: 'all', ...params })
  return `${EXPLORE_BASE}/${path}?${q.toString()}`
}

async function attempt<T>(
  endpoint: string,
  url: string,
  deps: RobloxDeps,
  parse: (body: unknown) => T,
  usable: (v: T) => boolean,
): Promise<{ ok: true; value: T; status: number } | { ok: false; attempt: EndpointAttempt }> {
  try {
    const res = await robloxGet(url, deps)
    if (!res.ok) return { ok: false, attempt: { endpoint, status: res.status } }
    const value = parse(await res.json())
    if (!usable(value)) return { ok: false, attempt: { endpoint, status: res.status, error: 'empty' } }
    return { ok: true, value, status: res.status }
  } catch (e) {
    if (e instanceof RobloxThrottleTripped) throw e
    return { ok: false, attempt: { endpoint, status: null, error: e instanceof Error ? e.message : String(e) } }
  }
}

/** Top-playing / trending / up-and-coming, with the documented fallback. */
export async function fetchSorts(deps: RobloxDeps): Promise<Sorts> {
  const attempts: EndpointAttempt[] = []

  const primary = await attempt(
    'get-sorts',
    exploreUrl('get-sorts', {}),
    deps,
    parseSortsResponse,
    (s) => s.topPlayingNow.length > 0,
  )
  if (primary.ok) return { ...primary.value, endpoint: 'get-sorts' }
  attempts.push(primary.attempt)

  const fallback = await attempt(
    'get-sort-content',
    exploreUrl('get-sort-content', { sortId: 'top-playing-now' }),
    deps,
    parseSortContentResponse,
    (g) => g.length > 0,
  )
  if (fallback.ok) {
    return { topPlayingNow: fallback.value, topTrending: [], upAndComing: [], endpoint: 'get-sort-content' }
  }
  attempts.push(fallback.attempt)

  throw new RobloxEndpointError({
    endpoint: 'get-sort-content',
    status: fallback.attempt.status,
    fallbackTried: true,
    attempts,
  })
}

// ── IO: metrics ────────────────────────────────────────────────────────────

/** playing / visits / favorites for every id, in paced batches of 50. */
export async function fetchGameMetrics(universeIds: number[], deps: RobloxDeps): Promise<GameMetricsRow[]> {
  const ids = Array.from(new Set(universeIds))
  const rows: GameMetricsRow[] = []
  for (const batch of chunk(ids, METRICS_BATCH_SIZE)) {
    const url = `${GAMES_BASE}?universeIds=${batch.join(',')}`
    const res = await robloxGet(url, deps)
    if (!res.ok) {
      throw new RobloxEndpointError({
        endpoint: 'games',
        status: res.status,
        fallbackTried: false,
        attempts: [{ endpoint: 'games', status: res.status }],
      })
    }
    rows.push(...parseGamesBatch(await res.json()))
  }
  return rows
}
