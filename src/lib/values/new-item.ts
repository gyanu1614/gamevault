/**
 * The New badge rule (owner, 2026-10-21), one helper for list cards, item
 * heroes, sell-page rows and the admin Values tab: with a known release date,
 * New means released within 14 days; without one, added (the row's
 * created_at) within 14 days. Uses dates the row already has, so a backlog
 * import (82 brainrots from three months) never makes old items look new.
 */
export const NEW_ITEM_DAYS = 14
const DAY = 86_400_000

export function isNewItem({ releasedAt, addedAt }: { releasedAt?: string | null; addedAt?: string | null }, now: number = Date.now()): boolean {
  const ref = releasedAt ?? addedAt
  if (!ref) return false
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(ref) ? `${ref}T00:00:00Z` : ref)
  if (Number.isNaN(t)) return false
  const age = now - t
  // A day of slack for time zones; a date further ahead is a wiki typo, not "new".
  return age >= -DAY && age <= NEW_ITEM_DAYS * DAY
}
