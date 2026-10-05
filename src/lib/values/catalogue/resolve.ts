/**
 * Structured market identity → catalogue row.
 *
 * Marketplace names and wiki page titles disambiguate the same item
 * differently. Eldorado says type + "Adurite"; the wiki titles it
 * "Adurite (Knife)". Eldorado says "Bats (2018)" as a knife; the wiki says
 * "Bats Knife (2018)". So every catalogue row publishes the market keys its
 * title can appear under, and a listing resolves by exact key:
 *
 *   `${itemType}|${variant}|${comparableName(name)}`
 *
 * A chroma row ("Chroma Fang") publishes its BASE name under the `chroma`
 * variant, because the market sells it as item "Fang" + attribute Chroma.
 *
 * Order of trust: the exact wiki title / infobox title (1.0) → a title with
 * its type qualifier removed (0.9) → a reviewed alias (0.85) → the name plus
 * the row's release year, "Harvester (2021)" (0.8). A derived or year key
 * two rows both claim is dropped (ambiguous) rather than guessed. Nothing
 * fuzzy: a name that resolves to nothing goes to the alias review file.
 *
 * Pure; no `@/` imports (loaded by tsx scripts).
 */
import { comparableName, marketKey } from '../normalisers/eldorado-structured'

export interface CatalogueEntry {
  slug: string
  /** Wiki page title, e.g. "Adurite (Knife)", "Chroma Fang", "Bat (Pet)". */
  title: string
  /** Infobox display title when it differs ("Bat" for "Bat (Pet)"). */
  displayTitle?: string | null
  /** knife | gun | pet | misc | set */
  itemType: string | null
  /** True for a "Chroma X" row (has a base). */
  isChroma: boolean
  /**
   * First year the item could be obtained. Eldorado suffixes most event items
   * with it ("Harvester (2021)") even when the name is unique, so a row with a
   * known year also answers to "<name> (<year>)".
   */
  releaseYear?: number | null
}

export interface MarketAlias {
  /** A market key as produced by `marketKey()`. */
  key: string
  slug: string
}

export interface MarketIndex {
  bySlug: Map<string, { slug: string; confidence: number; via: 'title' | 'derived' | 'year' | 'alias' }>
  byKey: Map<string, { slug: string; confidence: number; via: 'title' | 'derived' | 'year' | 'alias' }>
  /** Derived keys two rows claimed — never resolved. */
  ambiguousKeys: Set<string>
}

const TYPE_WORD: Record<string, string> = { knife: 'Knife', gun: 'Gun', pet: 'Pet', misc: 'Misc' }
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The names a catalogue title is sold under, best first.
 * `exact` = the title itself; `derived` = type qualifier removed.
 */
export function marketNamesFor(title: string, itemType: string | null): { exact: string[]; derived: string[] } {
  const exact = [title]
  const derived: string[] = []
  const word = itemType ? TYPE_WORD[itemType] : undefined
  if (word) {
    const w = escapeRe(word)
    // "Adurite (Knife)" -> "Adurite"
    const qualifier = title.match(new RegExp(`^(.*\\S)\\s+\\(${w}\\)$`, 'i'))
    if (qualifier) derived.push(qualifier[1])
    // "Bats Knife (2018)" -> "Bats (2018)";  "Stickers Gun (Halloween 2021)" -> "Stickers (Halloween 2021)"
    const typed = title.match(new RegExp(`^(.*\\S)\\s+${w}\\s+(\\([^)]*\\))$`, 'i'))
    if (typed) derived.push(`${typed[1]} ${typed[2]}`)
    // "Bats Knife" -> "Bats" (only when the type word ends the title)
    const trailing = title.match(new RegExp(`^(.*\\S)\\s+${w}$`, 'i'))
    if (trailing) derived.push(trailing[1])
  }
  return { exact, derived }
}

function chromaBase(name: string): string | null {
  const m = name.match(/^chroma\s+(.+)$/i)
  return m ? m[1] : null
}

/** Build the exact-key index for one game's catalogue (+ reviewed aliases). */
export function buildMarketIndex(entries: CatalogueEntry[], aliases: MarketAlias[] = []): MarketIndex {
  const titleClaims = new Map<string, Set<string>>()
  const derivedClaims = new Map<string, Set<string>>()
  const yearClaims = new Map<string, Set<string>>()
  const claim = (map: Map<string, Set<string>>, key: string, slug: string) => {
    const set = map.get(key) ?? new Set<string>()
    set.add(slug)
    map.set(key, set)
  }

  for (const e of entries) {
    if (!e.itemType) continue
    const variant = e.isChroma ? 'chroma' : 'default'
    // The infobox display title ("Waves" on "Waves Knife (Rare)") is only a
    // derived name: it must never out-rank another page's real title.
    const titles = [
      { t: e.title, display: false },
      ...(e.displayTitle && e.displayTitle !== e.title ? [{ t: e.displayTitle, display: true }] : []),
    ]
    for (const { t, display } of titles) {
      const names = marketNamesFor(t, e.itemType)
      const exact = display ? [] : names.exact
      const derived = display ? [...names.exact, ...names.derived] : names.derived
      for (const name of exact) {
        const n = e.isChroma ? chromaBase(name) : name
        if (n) claim(titleClaims, marketKey(e.itemType, variant, n), e.slug)
      }
      for (const name of derived) {
        const n = e.isChroma ? chromaBase(name) : name
        if (n) claim(derivedClaims, marketKey(e.itemType, variant, n), e.slug)
      }
      // "Harvester" released 2021 also sells as "Harvester (2021)". Only for a
      // name that carries no parenthetical of its own.
      if (e.releaseYear) {
        for (const name of [...exact, ...derived]) {
          if (/\(/.test(name)) continue
          const n = e.isChroma ? chromaBase(name) : name
          if (n) claim(yearClaims, marketKey(e.itemType, variant, `${n} (${e.releaseYear})`), e.slug)
        }
      }
    }
  }

  const byKey: MarketIndex['byKey'] = new Map()
  const ambiguousKeys = new Set<string>()
  // An exact title beats a derived name; two rows claiming the same key at
  // the same level are ambiguous and never guessed between.
  for (const [key, slugs] of titleClaims) {
    if (slugs.size === 1) byKey.set(key, { slug: [...slugs][0], confidence: 1, via: 'title' })
    else ambiguousKeys.add(key)
  }
  for (const [key, slugs] of derivedClaims) {
    if (titleClaims.has(key)) continue
    if (slugs.size === 1) byKey.set(key, { slug: [...slugs][0], confidence: 0.9, via: 'derived' })
    else ambiguousKeys.add(key)
  }
  for (const [key, slugs] of yearClaims) {
    if (titleClaims.has(key) || derivedClaims.has(key)) continue
    if (slugs.size === 1) byKey.set(key, { slug: [...slugs][0], confidence: 0.8, via: 'year' })
    else ambiguousKeys.add(key)
  }
  // Reviewed aliases last: they fill gaps and settle ambiguous keys, but never
  // override an exact title match.
  const known = new Set(entries.map((e) => e.slug))
  for (const a of aliases) {
    if (!known.has(a.slug)) continue
    if (byKey.get(a.key)?.via === 'title') continue
    byKey.set(a.key, { slug: a.slug, confidence: 0.85, via: 'alias' })
    ambiguousKeys.delete(a.key)
  }

  const bySlug: MarketIndex['bySlug'] = new Map()
  for (const [, v] of byKey) if (!bySlug.has(v.slug)) bySlug.set(v.slug, v)
  return { byKey, bySlug, ambiguousKeys }
}

export interface Resolution {
  slug: string | null
  confidence: number | null
  via: 'title' | 'derived' | 'year' | 'alias' | null
  note?: string
}

/**
 * `rarity` (the listing's structured rarity) is tried FIRST as a qualifier:
 * the wiki splits same-named items by rarity ("Laser (Godly)" vs
 * "Laser (Vintage)", "Waves Knife (Rare)" vs "Waves"), and only those pages
 * publish a rarity-qualified key, so the more specific page wins.
 */
export function resolveMarketKey(key: string | null, index: MarketIndex, opts: { rarity?: string | null } = {}): Resolution {
  if (!key) return { slug: null, confidence: null, via: null, note: 'no market key' }
  const rarity = opts.rarity ? comparableName(opts.rarity) : ''
  const qualified = rarity ? index.byKey.get(`${key} ${rarity}`) : undefined
  const hit = qualified ?? index.byKey.get(key)
  if (hit) return { slug: hit.slug, confidence: hit.confidence, via: hit.via }
  if (index.ambiguousKeys.has(key)) {
    return { slug: null, confidence: null, via: null, note: 'ambiguous: several catalogue rows claim this name' }
  }
  return { slug: null, confidence: null, via: null, note: 'no catalogue row for this name' }
}

/**
 * Best-effort suggestion for the alias REVIEW file only (never used to
 * match): catalogue rows of the same type+variant whose comparable name
 * starts with, or shares the first word of, the unmatched name.
 */
export function suggestForReview(key: string, entries: CatalogueEntry[], limit = 3): string[] {
  const [type, variant, name] = key.split('|')
  const first = comparableName(name ?? '').replace(/\s*\d{4}$/, '').split(' ')[0]
  if (!first) return []
  return entries
    .filter((e) => e.itemType === type && (variant === 'chroma') === e.isChroma)
    .filter((e) => comparableName(e.title).replace(/^chroma /, '').split(' ')[0] === first)
    .slice(0, limit)
    .map((e) => e.slug)
}
