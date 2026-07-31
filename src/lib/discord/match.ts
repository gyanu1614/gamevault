/**
 * Fuzzy name matching for Brainrot lookups.
 *
 * Why hand-rolled rather than reusing the ingest pipeline's alias tables:
 * `sab_brainrot_aliases` is revoked from `anon`, and `sab_brainrots.aliases` is
 * an empty array on all 498 rows. So the bot has nothing to lean on and has to
 * do its own matching against the catalog names.
 *
 * Two very different queries have to work:
 *   - autocomplete, where the user has typed "gar" and expects
 *     "Garama and Madundung" — prefix/substring work, edit distance does not.
 *   - /wfl free text, where the user typed "vampire quesadillo" and the catalog
 *     says "Quesadillo Vampiro" — word order and spelling both drift, so this
 *     needs similarity, not prefixes.
 *
 * Hence the tiered score: cheap exact/prefix/substring tiers first, then
 * order-independent token coverage, then a bigram Dice coefficient as the
 * last resort. Scores are ordinal only — the absolute numbers just keep the
 * tiers from overlapping.
 */

/**
 * Mirrors the DB's `sab_normalize_market_text`: lowercase, collapse every run
 * of non-alphanumerics to a single space, trim. Keeping these identical means
 * the bot matches names the same way the ingest parser does.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Bigram multiset of a string, used by the Dice coefficient. */
function bigramCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>()

  for (let index = 0; index < value.length - 1; index += 1) {
    const gram = value.slice(index, index + 2)
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }

  return counts
}

/**
 * Sørensen–Dice similarity over character bigrams, in [0,1].
 *
 * Bigram sets are order-insensitive, which is exactly why this handles the
 * word-order drift ("Vampire Quesadillo" vs "Quesadillo Vampiro" scores ~0.8)
 * that a straight edit distance would punish.
 */
export function diceCoefficient(left: string, right: string): number {
  if (left === right) return 1
  if (left.length < 2 || right.length < 2) return 0

  const leftGrams = bigramCounts(left)
  const rightGrams = bigramCounts(right)

  let shared = 0
  let leftTotal = 0
  let rightTotal = 0

  for (const count of leftGrams.values()) leftTotal += count
  for (const count of rightGrams.values()) rightTotal += count

  for (const [gram, count] of leftGrams) {
    const other = rightGrams.get(gram)
    if (other) shared += Math.min(count, other)
  }

  return (2 * shared) / (leftTotal + rightTotal)
}

/** Below this many characters, similarity is noise — require exact/prefix. */
const MIN_FUZZY_TOKEN_LENGTH = 3

/**
 * How well every query token is covered by some candidate token, ignoring
 * order. Returns -1 when any query token finds no plausible partner, so a
 * query with one junk word can't ride in on the strength of the others.
 */
function tokenCoverage(query: string, candidate: string): number {
  const queryTokens = query.split(' ').filter(Boolean)
  const candidateTokens = candidate.split(' ').filter(Boolean)

  if (!queryTokens.length || !candidateTokens.length) return -1

  let total = 0

  for (const queryToken of queryTokens) {
    let best = 0

    for (const candidateToken of candidateTokens) {
      if (candidateToken === queryToken) {
        best = 1
        break
      }

      if (candidateToken.startsWith(queryToken)) {
        best = Math.max(best, 0.9)
        continue
      }

      if (queryToken.length >= MIN_FUZZY_TOKEN_LENGTH) {
        best = Math.max(best, diceCoefficient(queryToken, candidateToken))
      }
    }

    if (best < 0.5) return -1

    total += best
  }

  return total / queryTokens.length
}

/**
 * Score a normalized query against a normalized candidate name.
 * 0 means "not a match" — callers should drop it, not rank it last.
 */
export function scoreMatch(query: string, candidate: string): number {
  if (!query || !candidate) return 0

  if (query === candidate) return 1000

  // "gar" → "garama and madundung". Shorter completions rank above longer ones.
  if (candidate.startsWith(query)) {
    return 900 - Math.min(89, candidate.length - query.length)
  }

  // The user pasted something with trailing noise: "garama and madundung pet".
  if (query.startsWith(candidate)) return 860

  const position = candidate.indexOf(query)
  if (position > 0) return 800 - Math.min(89, position)

  const coverage = tokenCoverage(query, candidate)
  if (coverage >= 0.6) return 600 + Math.round(coverage * 150)

  const similarity = diceCoefficient(query, candidate)
  if (similarity >= 0.45) return Math.round(similarity * 400)

  return 0
}

export type Scorable = {
  /** Pre-normalized name, so ranking never re-normalizes 498 rows per keypress. */
  normalized: string
}

export type Ranked<T> = {
  item: T
  score: number
}

/**
 * Rank candidates against a raw (un-normalized) query, best first.
 * An empty query returns the first `limit` candidates untouched, which is what
 * Discord shows the moment the user focuses an autocomplete field.
 */
export function rankMatches<T extends Scorable>(
  rawQuery: string,
  candidates: T[],
  limit: number,
): Ranked<T>[] {
  const query = normalizeText(rawQuery)

  if (!query) {
    return candidates.slice(0, limit).map((item) => ({ item, score: 0 }))
  }

  const ranked: Ranked<T>[] = []

  for (const item of candidates) {
    const score = scoreMatch(query, item.normalized)
    if (score > 0) ranked.push({ item, score })
  }

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.item.normalized.localeCompare(right.item.normalized)
  })

  return ranked.slice(0, limit)
}

/** Best single match, or null when nothing clears `minScore`. */
export function bestMatch<T extends Scorable>(
  rawQuery: string,
  candidates: T[],
  minScore = 300,
): T | null {
  const [top] = rankMatches(rawQuery, candidates, 1)
  if (!top || top.score < minScore) return null
  return top.item
}
