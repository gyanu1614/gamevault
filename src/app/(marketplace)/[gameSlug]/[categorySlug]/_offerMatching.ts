/**
 * V28 — Same-item matching for the listing detail page's "Other Sellers"
 * section.
 *
 * Problem: "show other sellers of THIS item" needs a notion of item
 * identity, but identity lives in different places per game (verified
 * against real listings):
 *
 *   steal-a-brainrot  {rarity, item-type, select-brainrot}   → identity in
 *                     `select-brainrot`; rarity/mutation are VALUE variants
 *                     (a Diamond dragon ≠ base dragon price-wise).
 *   adopt-me          {trait: "r", egg-name, item-type-2}    → admin named
 *                     the keys arbitrarily; identity is really the TITLE
 *                     ("NFR Parrot"), trait is a variant.
 *   apex/cs2/fortnite {}                                     → no template
 *                     at all; identity is only the free-text title.
 *   roblox umbrella   {game: "adopt-me"}                     → `game` is a
 *                     HARD axis: same title under a different game is a
 *                     different item.
 *   gta-v             {platform: "playstation-4", item-type}  → platform is
 *                     a HARD axis: PS4 money isn't fungible with PC money.
 *
 * So keys are classified by PATTERN, not by a fixed list:
 *   identity — equals a known identity word, starts with "select-", or
 *              ends in "-name"/"_name" (e.g. select-brainrot, egg-name).
 *   hard     — game / platform / region / server: mismatch disqualifies
 *              the candidate from "same item" entirely.
 *   variant  — everything else (rarity, mutation, trait, item-type, …):
 *              mismatch demotes tier 1 → tier 2 ("same item, different
 *              variant"), shown but ranked below exact matches.
 *
 * Titles are normalized (delivery/marketing boilerplate stripped) so
 * "Dragon Cannelloni - Instant Delivery" matches "Dragon Cannelloni".
 *
 * Tiers:
 *   1 — same identity, all shared variant axes equal  → true price comparison
 *   2 — same identity, some variant differs           → shown with variant visible
 *   related — everything else, ranked by attribute overlap (the "most
 *             relevant" fallback when an item has no cross-seller twins).
 */

type TemplateData = Record<string, unknown> | null | undefined

/** Same semantics as _itemsData's slugify — kept local so this module
 *  stays pure (no `server-only` import chain) and unit-testable. */
function slugify(v: string): string {
  return v
    .toString()
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface MatchableListing {
  id: string
  title: string
  template_data: TemplateData
}

/* ── Key classification ─────────────────────────────────────────────── */

const IDENTITY_WORDS = new Set([
  'brainrot', 'pet', 'pet_name', 'item', 'item_name', 'skin', 'fruit',
  'knife', 'name', 'champion', 'weapon', 'unit', 'crop', 'sword',
])

/** Axes where a mismatch means "not the same purchasable item" at all. */
const HARD_KEYS = new Set(['game', 'platform', 'region', 'server'])

function isIdentityKey(key: string): boolean {
  const k = key.toLowerCase()
  return (
    IDENTITY_WORDS.has(k) ||
    k.startsWith('select-') || k.startsWith('select_') ||
    k.endsWith('-name') || k.endsWith('_name')
  )
}

function isHardKey(key: string): boolean {
  return HARD_KEYS.has(key.toLowerCase())
}

/* ── Normalization ──────────────────────────────────────────────────── */

/** Marketing / delivery boilerplate that sellers append to titles. */
const TITLE_BOILERPLATE =
  /\b(instant|quick|fast|speedy|cheap(?:est)?|delivery|deliver|in\s*stock|stock|sale|hot|best|top|price|trusted|safe|legit|24\/7|now|new|og)\b/gi

/** Normalize a listing title down to its item-identity core. */
export function normalizeTitle(title: string): string {
  return slugify(
    title
      .toLowerCase()
      .replace(TITLE_BOILERPLATE, ' ')
      // Separators sellers use between name and boilerplate.
      .replace(/[|/\\•·★☆⚡🔥✅]+/g, ' '),
  )
}

function valueSlug(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return slugify(v)
  if (Array.isArray(v)) {
    const parts = v
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map(slugify)
      .sort()
    return parts.length ? parts.join('+') : null
  }
  return null
}

/* ── Signatures ─────────────────────────────────────────────────────── */

interface Signature {
  /** All plausible identity slugs: template identity values + normalized title. */
  identities: Set<string>
  /** Whether any identity came from template data (stronger than title). */
  hasTemplateIdentity: boolean
  hard: Map<string, string>
  variant: Map<string, string>
  /** Every key=value pair, for relevance overlap scoring. */
  pairs: Set<string>
}

function buildSignature(l: MatchableListing): Signature {
  const identities = new Set<string>()
  const hard = new Map<string, string>()
  const variant = new Map<string, string>()
  const pairs = new Set<string>()
  let hasTemplateIdentity = false

  for (const [key, raw] of Object.entries(l.template_data ?? {})) {
    const v = valueSlug(raw)
    if (!v) continue
    pairs.add(`${key.toLowerCase()}=${v}`)
    if (isIdentityKey(key)) {
      identities.add(v)
      hasTemplateIdentity = true
    } else if (isHardKey(key)) {
      hard.set(key.toLowerCase(), v)
    } else {
      variant.set(key.toLowerCase(), v)
    }
  }

  const titleSlug = normalizeTitle(l.title || '')
  if (titleSlug) identities.add(titleSlug)

  return { identities, hasTemplateIdentity, hard, variant, pairs }
}

/* ── Matching ───────────────────────────────────────────────────────── */

function identitiesIntersect(a: Signature, b: Signature): boolean {
  for (const id of a.identities) if (b.identities.has(id)) return true
  return false
}

/** Compare only the axes BOTH listings filled in — missing = wildcard. */
function sharedAxesEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  for (const [k, v] of a) {
    const other = b.get(k)
    if (other != null && other !== v) return false
  }
  return true
}

export type MatchTier = 1 | 2

export interface PartitionResult<T extends MatchableListing> {
  /** Same-item offers, tier-1 (exact variant) before tier-2, each tagged. */
  sameItem: Array<{ listing: T; tier: MatchTier }>
  /** Everything else, relevance-ranked (attribute overlap desc). */
  related: T[]
}

/**
 * Split candidates into "same item as `current`" (tiered) vs "related".
 * Candidates are assumed pre-filtered to the same game + category.
 */
export function partitionSameItem<T extends MatchableListing>(
  current: MatchableListing,
  candidates: T[],
): PartitionResult<T> {
  const cur = buildSignature(current)

  const sameItem: Array<{ listing: T; tier: MatchTier }> = []
  const scored: Array<{ listing: T; score: number }> = []

  for (const cand of candidates) {
    const sig = buildSignature(cand)

    const identityMatch = identitiesIntersect(cur, sig)
    const hardOk = sharedAxesEqual(cur.hard, sig.hard)

    if (identityMatch && hardOk) {
      const exactVariant = sharedAxesEqual(cur.variant, sig.variant)
      sameItem.push({ listing: cand, tier: exactVariant ? 1 : 2 })
      continue
    }

    // Relevance for the fallback: shared template pairs weigh most, a
    // same-identity-but-wrong-hard-axis twin still ranks above strangers.
    let score = 0
    for (const p of cur.pairs) if (sig.pairs.has(p)) score += 2
    if (identityMatch) score += 3
    scored.push({ listing: cand, score })
  }

  sameItem.sort((a, b) => a.tier - b.tier)
  scored.sort((a, b) => b.score - a.score)

  return { sameItem, related: scored.map((s) => s.listing) }
}
