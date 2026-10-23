/**
 * Close-name matching for marketplace listings (owner, 2026-10-23: "a small
 * change in Eldorado shouldn't break, rather we have a system which handles
 * it"). Exact matching stays first everywhere; this only pairs what exact
 * matching left over — a market name nobody claimed with a catalogue item
 * nothing claimed — and only when the answer is not in doubt:
 *
 *   - spelling-insensitive keys (case, accents, punctuation, "the", plurals);
 *   - the numbers must be identical ("Ice Cube 2018" is never "Ice Cube 2019");
 *   - score ≥ MIN_SCORE (a one-letter slip on a name of 9+ letters), with a
 *     clear lead over the next item (MIN_LEAD), and never on short names;
 *   - an item that already matched exactly this run is never a candidate, so
 *     a NEW market item can't pour its listings into an old item's price;
 *   - each item goes to at most one market name.
 *
 * Anything else comes back unmatched with suggestions, for the review list.
 * Pure, dependency-free JS: loaded by node/tsx scripts and by vitest.
 */

export const MIN_SCORE = 0.88
export const MIN_LEAD = 0.1
const MIN_KEY_LENGTH = 6
const SUGGEST_FLOOR = 0.6

/** The spelling-insensitive form two names are compared in. */
export function matchKey(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'the')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
}

const numbersOf = (key) => (key.match(/\d+/g) ?? []).join(' ')

/** Optimal-string-alignment edit distance (a swap of two letters is one edit). */
function editDistance(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  const d = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j < cols; j += 1) d[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[rows - 1][cols - 1]
}

const ratio = (a, b) => 1 - editDistance(a, b) / Math.max(a.length, b.length, 1)
const sortedWords = (k) => k.split(' ').sort().join(' ')

/** 0..1; 0 whenever the numbers differ. Word order does not matter. */
export function nameSimilarity(a, b) {
  const ka = matchKey(a)
  const kb = matchKey(b)
  if (!ka || !kb || numbersOf(ka) !== numbersOf(kb)) return 0
  if (ka === kb) return 1
  return Math.max(ratio(ka, kb), ratio(sortedWords(ka), sortedWords(kb)))
}

/**
 * `candidates`: [{ slug, names: string[] }]. Returns { slug, score } when one
 * item is a confident match, else { slug: null, suggestions: [{ slug, score }] }.
 */
export function closeMatch(name, candidates) {
  const key = matchKey(name)
  const scored = candidates
    .map((c) => ({ slug: c.slug, score: Math.max(0, ...c.names.map((n) => nameSimilarity(name, n))) }))
    .sort((x, y) => y.score - x.score)
  const [best, second] = scored
  const confident =
    best &&
    best.score >= MIN_SCORE &&
    best.score - (second?.score ?? 0) >= MIN_LEAD &&
    key.replace(/ /g, '').length >= MIN_KEY_LENGTH
  if (confident) return { slug: best.slug, score: round(best.score) }
  return {
    slug: null,
    suggestions: scored.filter((s) => s.score >= SUGGEST_FLOOR).slice(0, 3).map((s) => ({ slug: s.slug, score: round(s.score) })),
  }
}

const round = (n) => Math.round(n * 1000) / 1000

/**
 * Market names exact matching left unmatched × catalogue items it left
 * unclaimed (`claimed` = slugs that matched exactly this run). Greedy by
 * score, one item per market name. `nameOf` picks the part of a market name
 * to compare (MM2 keys are "type|variant|name").
 */
export function pairUnmatched(marketNames, items, claimed, nameOf = (n) => n) {
  const candidates = items.filter((i) => !claimed.has(i.slug))
  const tries = marketNames.map((marketName) => ({ marketName, ...closeMatch(nameOf(marketName), candidates) }))
  const taken = new Set()
  const matched = []
  const unmatched = []
  for (const t of [...tries].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))) {
    if (t.slug && !taken.has(t.slug)) {
      taken.add(t.slug)
      matched.push({ marketName: t.marketName, slug: t.slug, score: t.score })
    } else {
      unmatched.push({
        marketName: t.marketName,
        suggestions: t.slug ? [{ slug: t.slug, score: t.score }] : t.suggestions,
      })
    }
  }
  return { matched, unmatched }
}
