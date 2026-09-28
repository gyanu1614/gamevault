/**
 * Is a seller online right now?
 *
 * seller_presence.is_online is only cleared by a DAILY cron
 * (mark_inactive_sellers_offline), so on its own it can say "online" for up
 * to a day after the seller left. The heartbeat (useMyPresence) stamps
 * last_seen_at every 2 minutes while a seller has the site open, so a seller
 * counts as online only when that stamp is recent: the same 5-minute window
 * the cron uses.
 */

export const ONLINE_WINDOW_MS = 5 * 60 * 1000

export function isSellerOnline(
  presence: { is_online?: boolean | null; last_seen_at?: string | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!presence?.is_online || !presence.last_seen_at) return false
  const seen = Date.parse(presence.last_seen_at)
  return Number.isFinite(seen) && now - seen <= ONLINE_WINDOW_MS
}
