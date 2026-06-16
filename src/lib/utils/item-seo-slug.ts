/**
 * V15 — SEO slug helpers for item listings.
 *
 * People typically Google for "<game> <mutation> <name> cheap" — e.g.
 * "steal a brainrot neon garama mandundung". We mirror that order in
 * the URL so the keyword appears in the path, the H1, and the meta
 * title, then 301 from any non-canonical alias.
 *
 * Canonical URL shape:
 *   /{gameSlug}/{itemSlug}
 *
 * Where `itemSlug` is `{mutation}-{brainrot}` kebab-cased (mutation
 * omitted when the listing has none, in which case it's just
 * `/{gameSlug}/{brainrot}`).
 *
 * Collisions: if two listings would resolve to the same slug, we append
 * `-{listingIdPrefix6}`. The first listing keeps the clean slug; later
 * ones get the suffix. This keeps the common case clean for SEO.
 */

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or'])

/** Convert any string to a URL-safe kebab-case slug. */
export function kebab(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((part) => part && !STOPWORDS.has(part))
    .join('-')
}

/**
 * Build the canonical itemSlug from a listing's template_data.
 *
 * Looks for the primary identity field (brainrot/pet/skin/etc.) and the
 * modifier (mutation/type) under a small set of standard attribute slugs.
 * Falls back to the listing's stored title when no template field exists.
 */
export interface BuildSlugInput {
  templateData?: Record<string, unknown> | null
  title?: string | null
  /** Listing UUID — used to derive a stable disambiguation suffix when needed. */
  id?: string | null
}

const IDENTITY_KEYS = [
  'brainrot',
  'pet',
  'pet_name',
  'item',
  'item_name',
  'skin',
  'skin_name',
  'fruit',
  'fruit_name',
  'knife',
  'knife_name',
  'name',
] as const

const MODIFIER_KEYS = [
  'mutation',
  'modifier',
  'modifiers',
  'type',
  'variant',
  'rarity',
] as const

function pickFirstString(
  data: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  if (!data) return null
  for (const k of keys) {
    const v = data[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0]
  }
  return null
}

/** Build the canonical slug body (without any disambiguation suffix). */
export function buildItemSlug(input: BuildSlugInput): string {
  const data = input.templateData ?? null
  const identity = pickFirstString(data, IDENTITY_KEYS)
  const modifier = pickFirstString(data, MODIFIER_KEYS)
  const identityKebab = kebab(identity || input.title || 'item')
  const modifierKebab = kebab(modifier)
  if (modifierKebab && identityKebab && modifierKebab !== identityKebab) {
    return `${modifierKebab}-${identityKebab}`
  }
  return identityKebab || 'item'
}

/** Append a stable 6-char disambiguator from the listing UUID. */
export function withDisambiguator(slug: string, id: string | null | undefined): string {
  if (!id) return slug
  return `${slug}-${id.slice(0, 6)}`
}

/**
 * Server-side helper: given a desired slug body, return the final slug
 * with a disambiguator if and only if another active listing already
 * owns the clean form. Caller is responsible for the DB lookup.
 */
export function pickFinalSlug(
  desired: string,
  isTaken: boolean,
  fallbackId: string | null | undefined,
): string {
  if (!isTaken) return desired
  return withDisambiguator(desired, fallbackId)
}
