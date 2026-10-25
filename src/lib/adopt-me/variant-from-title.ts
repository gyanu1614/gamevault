/**
 * Adopt Me: which of the eight value-page variants a listing title names.
 *
 * The seller's pick in the Trait field is the source of truth; this only
 * helps. The sell form pre-selects from it when nothing is picked, flags a
 * pick it disagrees with, and the bulk importer reads it when a row has no
 * variant column. It runs on writes only (form, publish/edit, import, the
 * admin mismatch list), never on a public page request.
 *
 * Returns null whenever the title is unclear: no variant named, two different
 * ones ("FR + NFR", "FR/NFR"), negated ("not FR"), a bundle ("+", "&",
 * "bundle", "set" …), or a variant the value pages don't have (NR, MF …).
 *
 * Plain TS, no imports beyond the variant list: safe in client components,
 * server actions and Node scripts.
 */
import type { Variant } from './variants'

type Tier = 'normal' | 'neon' | 'mega'
type Potion = 'none' | 'f' | 'r' | 'fr'

interface Mention {
  tier: Tier
  potion: Potion
  /** A tier word on its own ("Neon Frost Dragon"): it can join a fuller mention of the same tier. */
  bare?: boolean
}

/** Multi-word spellings folded into one token before splitting. Order matters. */
const PHRASES: ReadonlyArray<[RegExp, string]> = [
  [/\bmega[\s-]*neon\b/g, ' mega '],
  [/\bno[\s-]*potions?\b/g, ' np '],
  [/\b(?:fly[\s-]*(?:and|n|&|\+|\/)?[\s-]*ride|ride[\s-]*(?:and|n|&|\+|\/)?[\s-]*fly)\b/g, ' fr '],
  [/\bf\s*[/&+]?\s*r\b/g, ' fr '],
]

const BUNDLE = /[+&]|\b(?:bundles?|sets?|packs?|combos?|lots?)\b/
const NEGATIONS: ReadonlySet<string> = new Set(['not', 'no', 'non', 'without', 'except', 'excluding', 'isnt', 'never'])

const TIER_TOKENS: Readonly<Record<string, Tier>> = { neon: 'neon', n: 'neon', mega: 'mega', m: 'mega', normal: 'normal', regular: 'normal' }
const POTION_TOKENS: Readonly<Record<string, Potion>> = { fr: 'fr', f: 'f', r: 'r', fly: 'f', ride: 'r', np: 'none' }
/** Codes that carry both halves. NF / NR / MF / MR are real but have no value page. */
const FULL_CODES: Readonly<Record<string, Mention>> = {
  nfr: { tier: 'neon', potion: 'fr' },
  mfr: { tier: 'mega', potion: 'fr' },
  nf: { tier: 'neon', potion: 'f' },
  nr: { tier: 'neon', potion: 'r' },
  mf: { tier: 'mega', potion: 'f' },
  mr: { tier: 'mega', potion: 'r' },
}
/** One-letter tiers mean nothing on their own ("N Frost Dragon"). */
const LETTER_TIERS: ReadonlySet<string> = new Set(['n', 'm'])

const VARIANT_OF: Readonly<Record<string, Variant>> = {
  'normal:none': 'N',
  'normal:f': 'F',
  'normal:r': 'R',
  'normal:fr': 'FR',
  'neon:none': 'NEON',
  'neon:fr': 'NFR',
  'mega:none': 'MEGA',
  'mega:fr': 'MFR',
}

const VARIANT_WORDS: ReadonlySet<string> = new Set([
  ...Object.keys(TIER_TOKENS),
  ...Object.keys(POTION_TOKENS),
  ...Object.keys(FULL_CODES),
  'potion',
  'potions',
])

function normalize(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function foldPhrases(text: string): string {
  return PHRASES.reduce((s, [re, to]) => s.replace(re, to), text)
}

function words(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean)
}

function removeName(text: string, itemName: string | undefined): string {
  if (!itemName) return text
  const name = words(normalize(itemName)).join(' ')
  if (!name) return text
  return ` ${words(text).join(' ')} `.split(` ${name} `).join(' ')
}

/** Each variant the tokens name, or null when one of them can't be trusted. */
function readMentions(tokens: readonly string[]): Mention[] | null {
  const out: Mention[] = []
  for (let i = 0; i < tokens.length; i++) {
    const start = i
    const t = tokens[i]
    let mention: Mention | null = null
    if (FULL_CODES[t]) mention = FULL_CODES[t]
    else if (TIER_TOKENS[t]) {
      const next = POTION_TOKENS[tokens[i + 1]]
      if (next) {
        mention = { tier: TIER_TOKENS[t], potion: next }
        i++
      } else if (LETTER_TIERS.has(t)) return null
      else mention = { tier: TIER_TOKENS[t], potion: 'none', bare: true }
    } else if (POTION_TOKENS[t]) mention = { tier: 'normal', potion: POTION_TOKENS[t] }
    if (!mention) continue
    if (NEGATIONS.has(tokens[start - 1] ?? '')) return null
    out.push(mention)
  }
  return out
}

/** The one variant every mention agrees on; a bare tier joins a fuller mention of its tier. */
function agree(mentions: readonly Mention[]): Variant | null {
  if (mentions.length === 0) return null
  const full = mentions.filter((m) => !m.bare)
  const pool = full.length > 0 ? full : mentions
  if (mentions.some((m) => m.bare && !pool.some((p) => p.tier === m.tier))) return null
  const keys = new Set(pool.map((m) => `${m.tier}:${m.potion}`))
  if (keys.size !== 1) return null
  return VARIANT_OF[[...keys][0]] ?? null
}

/** The variant a title names, or null when it names none or is unclear. */
export function variantFromTitle(title: string, opts: { itemName?: string } = {}): Variant | null {
  const folded = foldPhrases(removeName(normalize(title ?? ''), opts.itemName))
  if (BUNDLE.test(folded)) return null
  const mentions = readMentions(words(folded))
  return mentions ? agree(mentions) : null
}

/** The title with its variant words taken out (lowercase), for matching the item name. */
export function titleWithoutVariant(title: string): string {
  return words(foldPhrases(normalize(title ?? '')))
    .filter((w) => !VARIANT_WORDS.has(w))
    .join(' ')
}
