/**
 * The New badge rule (owner, 2026-10-21), one helper for list cards, item
 * heroes, sell-page rows and the admin Values tab: with a known release date,
 * New means released within 14 days; without one, added (the row's
 * created_at) within 14 days. Uses dates the row already has, so a backlog
 * import (82 brainrots from three months) never makes old items look new.
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

export function isNewItem({ releasedAt, addedAt }: { releasedAt?: string | null; addedAt?: string | null }, now: number = Date.now()): boolean {
  return withinDays(releasedAt ?? addedAt, NEW_ITEM_DAYS, now)
}

/**
 * The Google rule (owner, 2026-10-21): an item released (or added) in the last
 * 30 days with a How To Get and release info is indexable before it has price
 * data — people search a new item the week it comes out. Checked by the value
 * page gate before the per-game "needs a price" rules.
 */
export function isNewIndexable(
  input: { releasedAt?: string | null; addedAt?: string | null; hasHowToGet: boolean; hasReleaseInfo: boolean },
  now: number = Date.now(),
): boolean {
  if (!input.hasHowToGet || !input.hasReleaseInfo) return false
  return withinDays(input.releasedAt ?? input.addedAt, NEW_INDEX_DAYS, now)
}
