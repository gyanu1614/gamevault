/**
 * Shared variant-detection + noise-filtering for the Adopt Me cash collectors
 * (Eldorado, u7buy, …). Title-driven on purpose: marketplace "trait" fields are
 * unreliable, so the LISTING TITLE is the source of truth for the variant, and
 * toys/bundles/age-listings named after a pet are rejected.
 */

// Toys / non-pet items and bundles named after a pet — reject outright.
export const TOY_WORDS =
  /(duck(y|ies)|skateboard|sabre|saber|stroller|plush|\btoy\b|kingdom|castle|\bmap\b|\bbase\b|house|home|split|theme|bundle|pack|\bset\b|potion|\begg\b|account|\bacc\b|robux|sticker|poster)/

// Age listings ("Shadow Dragon - Teen") are the pet at a growth stage, not a
// tradable FR/Neon form — exclude so they don't pollute variant medians.
export const AGE_WORDS = /(newborn|junior|pre[ -]?teen|post[ -]?teen|\bteen\b|full ?grown|reborn|twinkle|sparkle|flare|sunshine|luminous)/

// Scam-listing title patterns. These are "add me in-game / friend request"
// bait listings priced at a few cents — not real sales. Eldorado's cheap fakes
// almost always carry one of these. Reject them outright.
export const SCAM_WORDS =
  /(you need add|you need to add|need to add|\badd me\b|add first|friend request|friend me|need friend|dm me|message me first|read desc|read description|not real|fake price)/

// Variants we publish as observed. NEON/MEGA plain forms are low-volume and
// easily confused with NFR/MFR in titles, so they stay out for now.
export const PUBLISHABLE_VARIANTS = new Set(['N', 'F', 'R', 'FR', 'NFR', 'MFR'])

/**
 * Infer the variant from a listing title. Most-specific first; returns null
 * when the title gives no clear signal (we never guess).
 */
export function variantFromTitle(title) {
  const t = ` ${String(title).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `
  const has = (re) => re.test(t)
  if (has(/\bmfr\b/) || has(/\bmega fly ride\b/) || has(/\bmega neon fly ride\b/)) return 'MFR'
  if (has(/\bnfr\b/) || has(/\bneon fly ride\b/)) return 'NFR'
  if (has(/\bmega neon\b/) || (has(/\bmega\b/) && !has(/\bfr\b|fly ride/))) return 'MEGA'
  if (has(/\bneon\b/) && !has(/\bfr\b|fly ride|fly|ride/)) return 'NEON'
  if (has(/\bfr\b/) || has(/\bfly ride\b/)) return 'FR'
  if (has(/\bfly\b/) && !has(/\bride\b/)) return 'F'
  if (has(/\bride\b/) && !has(/\bfly\b/)) return 'R'
  if (has(/\bnormal\b/) || has(/\bno potion\b/) || has(/\bdefault\b/)) return 'N'
  return null
}

export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Is this title exactly THIS pet (not a toy, bundle, age-listing, or a
 * different pet that merely contains the name)? Requires the pet name present,
 * no toy/age words, and only known modifier words left over after removing it.
 */
export function titleIsPet(title, petName) {
  const raw = String(title).toLowerCase()
  const nt = normalizeName(title)
  const np = normalizeName(petName)
  if (!nt.includes(np)) return false
  // Scam-bait ("add me / you need to add") checked on the RAW title (before
  // punctuation is stripped) so phrases survive normalization.
  if (SCAM_WORDS.test(raw)) return false
  if (TOY_WORDS.test(nt) || AGE_WORDS.test(nt)) return false
  const leftover = nt
    .replace(np, ' ')
    .split(' ')
    .filter(Boolean)
    .filter(
      (w) =>
        !/^(fr|nfr|mfr|nf|nr|mf|mr|n|f|r|m|none|neon|fly|ride|mega|adopt|me|pet|pets|the|a|an|for|sale|cheap|fast|op|instant|delivery|trusted|seller|online|ultra|rare|common|legendary|normal|24|7|to|and|item|items)$/.test(
          w,
        ),
    )
  return leftover.length === 0
}

/**
 * Resolve the variant for a listing: title decides; if a structured trait is
 * supplied it must agree (or be absent/ambiguous). Returns a publishable
 * variant string, or null to skip.
 */
export function resolveVariant(title, trait, traitAlias) {
  const v = variantFromTitle(title)
  if (!v || !PUBLISHABLE_VARIANTS.has(v)) return null
  if (trait && traitAlias && traitAlias[trait] && traitAlias[trait] !== v) return null
  return v
}
