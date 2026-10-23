/**
 * The New badge rule (owner, 2026-10-21; tightened 2026-10-23), one helper for
 * list cards, item heroes, sell-page rows and the admin Values tab. New means
 * new IN THE GAME, so it needs release information:
 *   - a release date (the wiki's) → released within 14 days;
 *   - only a release year (MM2) → this year AND added within 14 days;
 *   - neither → never new. The date we added a row is not evidence: the
 *     catalogue's first look-back and old-pet backfills added Dolphin, Camel
 *     and "Laser (Knife)" this month, and they are years old.
 */
export const NEW_ITEM_DAYS = 14
/** The Google rule's window: a new item with facts is indexable this long before it has price data. */
export const NEW_INDEX_DAYS = 30
const DAY = 86_400_000

function withinDays(ref: string | null | undefined, days: number, now: number): boolean {
  if (!ref) return false
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(ref) ? `${ref}T00:00:00Z` : ref)
  if (Number.isNaN(t)) return false
  const age = now - t
  // A day of slack for time zones; a date further ahead is a wiki typo, not "new".
  return age >= -DAY && age <= days * DAY
}

type NewInput = { releasedAt?: string | null; releaseYear?: number | null; addedAt?: string | null }

function isNewWithin({ releasedAt, releaseYear, addedAt }: NewInput, days: number, now: number): boolean {
  if (releasedAt) return withinDays(releasedAt, days, now)
  if (releaseYear != null) return releaseYear >= new Date(now).getUTCFullYear() && withinDays(addedAt, days, now)
  return false
}

export function isNewItem(input: NewInput, now: number = Date.now()): boolean {
  return isNewWithin(input, NEW_ITEM_DAYS, now)
}

/**
 * The Google rule (owner, 2026-10-21): an item released (or added) in the last
 * 30 days with a How To Get and release info is indexable before it has price
 * data — people search a new item the week it comes out. Checked by the value
 * page gate before the per-game "needs a price" rules.
 */
export function isNewIndexable(
  input: NewInput & { hasHowToGet: boolean; hasReleaseInfo: boolean },
  now: number = Date.now(),
): boolean {
  if (!input.hasHowToGet || !input.hasReleaseInfo) return false
  return isNewWithin(input, NEW_INDEX_DAYS, now)
}
