/**
 * Step 4 bulk importer — resolving a supplier's spelling to a catalogue item.
 *
 * Order: exact name → slug → alias (catalogue, then import-only) → fuzzy token
 * overlap. A fuzzy result is accepted ONLY when it is clearly ahead of the
 * runner-up; anything closer is `ambiguous` and goes to a human. An unresolved
 * row is never dropped — it carries its top 3 candidates into
 * listing_import_rows, which is the reviewer's work list.
 *
 * Normalisation is shared with the game-icon matcher (`normalizeTitle`): the
 * same casefolding, bracket-stripping and apostrophe-eliding rules. The SCORING
 * is deliberately NOT shared. `scoreCandidate` there rewards a candidate that
 * starts with the whole wanted title and adds a tagline, which is right for
 * "Creatures of Sonaria Survive Kaiju Animals" and badly wrong here: it would
 * match "Shadow Dragon" to "Shadow Dragon Egg" and sell the egg as the pet.
 *
 * Pure: no I/O, no game-specific knowledge. The index is built once per batch,
 * so a 1,000-row import is 1,000 in-memory lookups, not 1,000 queries.
 */
import { normalizeTitle } from '@/lib/games/icons'
import type { CatalogueItem, CatalogueVariant, ImportCatalogue } from './types'

/**
 * At or above this a fuzzy match is accepted. High on purpose: a wrong item is
 * a real listing at a real price for the wrong thing, which is worse than a row
 * in the review file.
 */
export const ACCEPT_SCORE = 0.9
/** Two candidates within this of each other are too close to call. */
export const AMBIGUITY_MARGIN = 0.05
/** How many candidates an unresolved row carries for the reviewer. */
export const MAX_CANDIDATES = 3

/**
 * Words a supplier stock list adds that carry no identity. Deliberately short:
 * only commerce noise, never a domain noun — "egg" is part of "Jungle Egg" and
 * "dragon" is part of half the Adopt Me catalogue.
 */
const NOISE_TOKENS = new Set([
  'the', 'a', 'an',
  'cheap', 'cheapest', 'fast', 'instant', 'quick',
  'delivery', 'deliver', 'stock', 'available', 'sale', 'selling', 'sell',
])

/** `x5`, `5x`, `X10` — a quantity marker, not part of the name. A BARE number
 *  is left alone: it may be part of an item's name. */
const QUANTITY_TOKEN = /^(?:x\d+|\d+x)$/

function contentTokens(normalized: string): string[] {
  return normalized
    .split(' ')
    .filter((t) => t && !NOISE_TOKENS.has(t) && !QUANTITY_TOKEN.test(t))
}

/** A slug ("shadow-dragon") normalises to the same token string as its name. */
function normalizeRef(ref: string): string {
  return normalizeTitle(ref.replace(/[-_]+/g, ' '))
}

function comparable(raw: string): string {
  return contentTokens(normalizeTitle(raw)).join(' ')
}

export interface ImportAlias {
  alias: string
  itemRef: string
}

export interface MatchCandidate {
  ref: string
  name: string
  score: number
}

export type ItemMatch =
  | { status: 'matched'; item: CatalogueItem; score: number }
  | { status: 'ambiguous'; candidates: MatchCandidate[] }
  | { status: 'unmatched'; candidates: MatchCandidate[] }

export interface MatchIndex {
  items: CatalogueItem[]
  variants: CatalogueVariant[]
  /** comparable form → every item that claims it (>1 ⇒ inherently ambiguous). */
  byExact: Map<string, CatalogueItem[]>
  /** comparable alias → item. An import alias wins over a catalogue alias. */
  byAlias: Map<string, CatalogueItem>
  /**
   * Slug in normalised-but-NOT-noise-stripped form → item. A slug is a precise
   * identifier, so it is matched precisely: stripping noise from `dragon-a`
   * would leave "dragon" and hand every vague "Dragon" row to that item.
   */
  bySlug: Map<string, CatalogueItem>
  byRef: Map<string, CatalogueItem>
  /** comparable variant code / label → variant. */
  byVariant: Map<string, CatalogueVariant>
}

/**
 * Build the lookup tables once per batch.
 *
 * `extraAliases` are the import-only spellings (listing_import_aliases). They
 * are applied LAST so a reviewer's decision beats a catalogue alias.
 */
export function buildMatchIndex(catalogue: ImportCatalogue, extraAliases: ImportAlias[]): MatchIndex {
  const byExact = new Map<string, CatalogueItem[]>()
  const byAlias = new Map<string, CatalogueItem>()
  const bySlug = new Map<string, CatalogueItem>()
  const byRef = new Map<string, CatalogueItem>()

  for (const it of catalogue.items) {
    byRef.set(it.ref, it)
    const key = comparable(it.name)
    if (key) {
      const bucket = byExact.get(key)
      if (bucket) bucket.push(it)
      else byExact.set(key, [it])
    }
    // The slug is a legitimate way to name an item, matched exactly.
    const slugKey = normalizeRef(it.ref)
    if (slugKey && !bySlug.has(slugKey)) bySlug.set(slugKey, it)
    for (const a of it.aliases) {
      const ak = comparable(a)
      if (ak && !byExact.has(ak)) byAlias.set(ak, it)
    }
  }

  for (const { alias, itemRef } of extraAliases) {
    const target = byRef.get(itemRef)
    if (!target) continue
    const ak = comparable(alias)
    if (ak) byAlias.set(ak, target)
  }

  const byVariant = new Map<string, CatalogueVariant>()
  for (const v of catalogue.variants) {
    for (const form of [v.ref, v.label]) {
      const k = comparable(form)
      if (k && !byVariant.has(k)) byVariant.set(k, v)
    }
  }

  return { items: catalogue.items, variants: catalogue.variants, byExact, byAlias, bySlug, byRef, byVariant }
}

/**
 * Token-overlap confidence in [0, 1).
 *
 * Jaccard over content tokens, scaled so a fuzzy result can never reach
 * ACCEPT_SCORE on overlap alone — only an exact name, slug or alias match is
 * ever auto-accepted. That is the conservative half of "ambiguous never
 * auto-matches".
 */
function score(wanted: string, candidate: string): number {
  const ta = contentTokens(normalizeTitle(wanted))
  const tb = contentTokens(normalizeTitle(candidate))
  if (ta.length === 0 || tb.length === 0) return 0
  const sa = new Set(ta)
  const sb = new Set(tb)
  let shared = 0
  for (const t of sa) if (sb.has(t)) shared += 1
  if (shared === 0) return 0
  const union = new Set([...ta, ...tb]).size
  return (shared / union) * 0.85
}

/** Resolve one input cell to a catalogue item. */
export function matchItem(index: MatchIndex, raw: string): ItemMatch {
  const key = comparable(raw ?? '')
  if (!key) return { status: 'unmatched', candidates: [] }

  // An import alias is a human decision: it outranks even a name collision.
  const aliased = index.byAlias.get(key)

  const exact = index.byExact.get(key)
  if (exact && exact.length === 1) return { status: 'matched', item: exact[0], score: 1 }
  if (exact && exact.length > 1) {
    // Two catalogue rows share this spelling. A human picks; we never guess.
    return {
      status: 'ambiguous',
      candidates: exact.slice(0, MAX_CANDIDATES).map((i) => ({ ref: i.ref, name: i.name, score: 1 })),
    }
  }

  const bySlugHit = index.bySlug.get(normalizeTitle(raw.replace(/[-_]+/g, ' ')))
  if (bySlugHit) return { status: 'matched', item: bySlugHit, score: 1 }

  if (aliased) return { status: 'matched', item: aliased, score: 0.98 }

  const ranked = index.items
    .map((i) => ({ ref: i.ref, name: i.name, score: score(raw, i.name) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  if (ranked.length === 0) return { status: 'unmatched', candidates: [] }

  const best = ranked[0]
  const runnerUp = ranked[1]
  const candidates = ranked.slice(0, MAX_CANDIDATES)

  if (best.score >= ACCEPT_SCORE && (!runnerUp || best.score - runnerUp.score > AMBIGUITY_MARGIN)) {
    return { status: 'matched', item: index.byRef.get(best.ref)!, score: best.score }
  }
  if (runnerUp && best.score - runnerUp.score <= AMBIGUITY_MARGIN) {
    return { status: 'ambiguous', candidates }
  }
  return { status: 'unmatched', candidates }
}

/**
 * Resolve the variant cell.
 *
 *   null        no variant — an empty cell, or a game with no variant axis
 *   'unknown'   the cell named something this game does not have; the caller
 *               rejects the row rather than dropping the distinction
 */
export function matchVariant(index: MatchIndex, raw: string | null | undefined): CatalogueVariant | null | 'unknown' {
  if (index.variants.length === 0) return null
  const key = comparable(raw ?? '')
  if (!key) return null
  return index.byVariant.get(key) ?? 'unknown'
}
