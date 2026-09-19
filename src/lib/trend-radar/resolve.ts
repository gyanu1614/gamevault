/**
 * Title → Roblox universe. Used by the external-id backfill (icons-match.csv
 * kept titles, not ids) and by prepare for rmt_chart events (Eldorado gives
 * a name only).
 *
 * The icon filler REFUSES a duplicate title; the radar must not — a top-30
 * game has to end up keyed. So a tie is broken by current playerCount (from
 * the sorts call, else one games-API batch) and the result is flagged
 * `ambiguous` so the review card shows the alternatives.
 */
/**
 * Import-free on purpose (same reason as lib/categories/ensure.ts): the
 * owner-run backfill script loads this with `node --experimental-strip-types`,
 * where `@/` aliases do not resolve. The matcher is injected; app code imports
 * the pre-wired `resolveUniverse` from `@/lib/trend-radar`.
 */

export interface IconCandidate {
  title: string
  id: string | number
}

export interface Matcher {
  decideMatch: (wanted: string, candidates: IconCandidate[]) => {
    status: 'matched' | 'ambiguous' | 'unmatched'
    best?: IconCandidate
    confidence: number
  }
  scoreCandidate: (wanted: string, candidate: string) => number
  acceptThreshold: number
}

export interface UniverseChoice {
  universeId: number
  matchedTitle: string
  confidence: number
  ambiguous: boolean
  /** False when a tie was broken without any playerCount (first candidate wins). */
  playerCountKnown: boolean
  candidates: { universeId: number; title: string; playing: number | null }[]
}

export function chooseUniverse(
  title: string,
  candidates: IconCandidate[],
  playingById: Map<number, number>,
  matcher: Matcher,
): UniverseChoice | null {
  const decision = matcher.decideMatch(title, candidates)
  if (decision.status === 'unmatched' || (decision.status === 'matched' && !decision.best)) return null

  if (decision.status === 'matched' && decision.best) {
    return {
      universeId: Number(decision.best.id),
      matchedTitle: decision.best.title,
      confidence: decision.confidence,
      ambiguous: false,
      playerCountKnown: playingById.has(Number(decision.best.id)),
      candidates: [],
    }
  }

  // Ambiguous: keep only the candidates that actually clear the bar, then
  // prefer the busiest one.
  const tied = candidates
    .map((c) => ({ c, score: matcher.scoreCandidate(title, c.title) }))
    .filter((x) => x.score >= matcher.acceptThreshold)
    .sort((a, b) => b.score - a.score)
  if (tied.length === 0) return null

  const withPlaying = tied.map((x) => ({
    universeId: Number(x.c.id),
    title: x.c.title,
    playing: playingById.get(Number(x.c.id)) ?? null,
    score: x.score,
  }))
  const known = withPlaying.some((x) => x.playing !== null)
  const winner = known
    ? [...withPlaying].sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1))[0]
    : withPlaying[0]

  return {
    universeId: winner.universeId,
    matchedTitle: winner.title,
    confidence: winner.score,
    ambiguous: true,
    playerCountKnown: known,
    candidates: [...withPlaying]
      .sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1))
      .map(({ universeId, title: t, playing }) => ({ universeId, title: t, playing })),
  }
}

export interface ResolveDeps {
  search: (title: string) => Promise<IconCandidate[]>
  /** universeId → playing from the sorts call (free). */
  playingById: Map<number, number>
  /** One paced games-API batch for ids the sorts did not cover. */
  fetchPlaying?: (ids: number[]) => Promise<Map<number, number>>
  matcher: Matcher
}

export async function resolveUniverse(title: string, deps: ResolveDeps): Promise<UniverseChoice | null> {
  const candidates = await deps.search(title)
  const first = chooseUniverse(title, candidates, deps.playingById, deps.matcher)
  if (!first || !first.ambiguous || first.playerCountKnown || !deps.fetchPlaying) return first

  const ids = first.candidates.map((c) => c.universeId)
  const fetched = await deps.fetchPlaying(ids)
  if (fetched.size === 0) return first
  const merged = new Map([...deps.playingById, ...fetched])
  return chooseUniverse(title, candidates, merged, deps.matcher)
}
