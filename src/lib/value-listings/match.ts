/**
 * Listing → value item matcher (pure; no server-only imports so it can run in
 * tests, scripts and the backfill alike).
 *
 * Listings carry no foreign key to a value item, and identity lives in
 * different places per game (see `_offerMatching.ts`):
 *   steal-a-brainrot  template `select-brainrot` = catalogue slug; the
 *                     mutation is usually only in the title ("Rainbow …").
 *   adopt-me          template `pet-name` = catalogue slug; the potion is the
 *                     `trait` option, whose SLUGS do not match their LABELS in
 *                     the live taxonomy (slug `r` = "Fly Ride (FR)", `fr` =
 *                     "Neon"), so variants resolve by label.
 *   other games       title only.
 *
 * Order: template identity → longest catalogue name in the title, both under
 * the whole-name rule below. Variant:
 * template field (by label) → longest variant name left in the title once the
 * item name is removed → the catalogue's default (SAB "default"; Adopt Me
 * leaves it unknown, since a bare "Bat Dragon" title doesn't say "no potion").
 */

export interface ValueCatalog {
  gameSlug: string
  items: ReadonlyArray<{ slug: string; name: string }>
  /** `key` is the URL segment; `names` are labels/aliases that identify it. */
  variants: ReadonlyArray<{ key: string; names: readonly string[] }>
  /** Template fields whose value is the catalogue item slug. */
  identityKeys?: readonly string[]
  /** Template fields whose value (or option label) names the variant. */
  variantKeys?: readonly string[]
  /** Variant assumed when a listing names none; omit to leave it unknown. */
  defaultVariant?: string
}

export interface ListingForMatch {
  title: string
  templateData: Record<string, unknown> | null | undefined
  /** attribute slug → option slug → option label (the category taxonomy). */
  optionLabels?: Record<string, Record<string, string>>
}

export interface ValueItemMatch {
  itemSlug: string
  variant: string | null
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function slugifyValue(value: string): string {
  return normalizeText(value).replace(/ /g, '-')
}

const pad = (s: string) => ` ${s} `

function templateString(data: ListingForMatch['templateData'], key: string): string | null {
  const v = data?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function variantFromLabel(catalog: ValueCatalog, label: string): string | null {
  const paren = label.match(/\(([^)]+)\)/)?.[1]
  const candidates = [label.replace(/\([^)]*\)/g, ''), paren, label].filter(
    (c): c is string => !!c && !!normalizeText(c),
  )
  for (const candidate of candidates) {
    const n = normalizeText(candidate)
    const slug = slugifyValue(candidate)
    const hit = catalog.variants.find(
      (v) => v.key === slug || v.names.some((name) => normalizeText(name) === n),
    )
    if (hit) return hit.key
  }
  return null
}

// ── Whole-name rule ─────────────────────────────────────────────────────────
// A catalogue name only identifies the listing when it is the WHOLE item name:
// "Fairy Bat Dragon NFR" names a pet we don't list, not a Bat Dragon. The word
// directly before the name (after skipping variant/quality tokens such as
// "Mega Neon", "NFR", "FR", or a SAB mutation) must be the start of the title,
// a separator ("|", " - ", "(" …), a number/rate ("250M/s", "x2") or a known
// filler word (game name, rarity, "cheap", "fast" …).

/** Separators that end a phrase in a title. Hyphen-minus stays inside words. */
const SEPARATOR_CHARS = /[|•·~–—:;,/\\()[\]{}<>!?+*#=]/g
/** "250M/s", "1.5B/s", "40k/sec" — a SAB income rate, never part of a name. */
const RATE = /\d+(?:[.,]\d+)?\s*[kmbt]?\s*\/\s*s(?:ec)?\b/gi
const BOUNDARY = '|'
const NUMERIC = /^(?:\d+[a-z]{0,2}|x\d+)$/

const FILLER_WORDS: ReadonlySet<string> = new Set([
  // game names
  'adopt', 'me', 'steal', 'a', 'an', 'brainrot', 'brainrots', 'roblox', 'egg', 'eggs',
  // rarity / quality words
  'common', 'uncommon', 'rare', 'ultra', 'epic', 'legendary', 'mythic', 'mythical', 'secret', 'god', 'og', 'limited',
  // marketplace words
  'buy', 'sell', 'selling', 'sale', 'wts', 'cheap', 'cheapest', 'fast', 'instant', 'quick', 'new', 'best', 'legit',
  'safe', 'trusted', 'premium', 'ready', 'stock', 'in', 'delivery', 'lowest', 'price', 'deal', 'gift', 'huge',
  'the', 'x', 'of', 'pet', 'pets', 'item', 'items', 'full', 'grown', 'for', 'and', 'with',
])

interface PreparedCatalog {
  /** Items with a normalized name, longest first (stable: catalogue order on ties). */
  items: Array<{ item: ValueCatalog['items'][number]; n: string; words: string[] }>
  bySlug: Map<string, { item: ValueCatalog['items'][number]; n: string; words: string[] }>
  /** Every word of every variant name, one-letter codes included. */
  variantTokens: Set<string>
  /** Variant names for free-text variant reading, longest first, >1 char. */
  variantNames: Array<{ key: string; n: string }>
}

const prepared = new WeakMap<ValueCatalog, PreparedCatalog>()

function prepare(catalog: ValueCatalog): PreparedCatalog {
  const hit = prepared.get(catalog)
  if (hit) return hit
  const items = catalog.items
    .map((item) => {
      const n = normalizeText(item.name)
      return { item, n, words: n ? n.split(' ') : [] }
    })
    .filter((x) => x.n)
    .sort((a, b) => b.n.length - a.n.length)
  const variantTokens = new Set<string>()
  for (const v of catalog.variants) {
    for (const name of v.names) for (const w of normalizeText(name).split(' ')) if (w) variantTokens.add(w)
  }
  const variantNames = catalog.variants
    .flatMap((v) => v.names.map((name) => ({ key: v.key, n: normalizeText(name) })))
    // One-letter codes ("N", "R") are too ambiguous in free text.
    .filter((x) => x.n.length > 1)
    .sort((a, b) => b.n.length - a.n.length)
  const out: PreparedCatalog = { items, bySlug: new Map(items.map((x) => [x.item.slug, x])), variantTokens, variantNames }
  prepared.set(catalog, out)
  return out
}

/** Title → normalized words with BOUNDARY markers where a phrase ends. */
function titleTokens(title: string): string[] {
  const tokens: string[] = []
  const spaced = title.replace(RATE, ` ${BOUNDARY} `).replace(SEPARATOR_CHARS, ` ${BOUNDARY} `)
  for (const chunk of spaced.split(/\s+/)) {
    if (!chunk) continue
    if (chunk === BOUNDARY) {
      tokens.push(BOUNDARY)
      continue
    }
    const n = normalizeText(chunk)
    // A chunk of pure punctuation (" - ", " & " is "and") ends a phrase.
    if (!n) tokens.push(BOUNDARY)
    else tokens.push(...n.split(' '))
  }
  return tokens
}

/**
 * Where the name occurs in the title: 'none', 'whole' (at least one occurrence
 * passes the leading-word rule) or 'foreign' (every occurrence is preceded by a
 * word that makes it a different item).
 */
function nameOccurrence(tokens: readonly string[], words: readonly string[], p: PreparedCatalog): 'none' | 'whole' | 'foreign' {
  let seen = false
  outer: for (let i = 0; i + words.length <= tokens.length; i++) {
    for (let k = 0; k < words.length; k++) if (tokens[i + k] !== words[k]) continue outer
    seen = true
    let j = i - 1
    while (j >= 0 && p.variantTokens.has(tokens[j])) j--
    const before = j >= 0 ? tokens[j] : BOUNDARY
    if (before === BOUNDARY || NUMERIC.test(before) || FILLER_WORDS.has(before)) return 'whole'
  }
  return seen ? 'foreign' : 'none'
}

export function matchListingToValueItem(
  listing: ListingForMatch,
  catalog: ValueCatalog,
): ValueItemMatch | null {
  const p = prepare(catalog)
  const title = pad(normalizeText(listing.title ?? ''))
  const tokens = titleTokens(listing.title ?? '')

  // 1. Identity: the template field, unless the title names the same item
  // only as part of a longer, different name (the seller picked the nearest
  // catalogue item for one we don't list).
  let item: ValueCatalog['items'][number] | undefined
  for (const key of catalog.identityKeys ?? []) {
    const raw = templateString(listing.templateData, key)
    if (!raw) continue
    const hit = p.bySlug.get(slugifyValue(raw))
    if (!hit) continue
    if (nameOccurrence(tokens, hit.words, p) === 'foreign') return null
    item = hit.item
    break
  }
  // …else the longest catalogue name the title contains as a whole name.
  if (!item) {
    for (const candidate of p.items) {
      if (!title.includes(pad(candidate.n))) continue
      if (nameOccurrence(tokens, candidate.words, p) === 'whole') {
        item = candidate.item
        break
      }
    }
  }
  if (!item) return null

  // 2. Variant: template field first (by option label).
  for (const key of catalog.variantKeys ?? []) {
    const raw = templateString(listing.templateData, key)
    if (!raw) continue
    const label = listing.optionLabels?.[key]?.[raw] ?? raw
    const variant = variantFromLabel(catalog, label)
    if (variant) return { itemSlug: item.slug, variant }
  }

  // 3. Variant from what is left of the title once the item name is removed,
  // so a mutation word inside an item's own name ("Lava Boss") isn't read.
  const itemName = normalizeText(item.name)
  const rest = itemName ? title.replace(pad(itemName), '  ') : title
  const hit = p.variantNames.find((x) => rest.includes(pad(x.n)))
  if (hit) return { itemSlug: item.slug, variant: hit.key }

  return { itemSlug: item.slug, variant: catalog.defaultVariant ?? null }
}
