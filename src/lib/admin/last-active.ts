/**
 * admin_roles.last_active_at is "seen in the last few minutes", not an audit
 * trail (that is admin_activity_log). The admin layout and requireAdmin()
 * (≈150 call sites: every admin page render and server action) each wrote it
 * on EVERY call; the admin activities page alone wrote it once a minute per
 * open tab. Now it is written only when the stored value is stale.
 */

export const ADMIN_LAST_ACTIVE_WRITE_MS = 5 * 60_000

export function shouldTouchAdminLastActive(
  lastActiveAt: string | null | undefined,
  now: number = Date.now(),
  everyMs: number = ADMIN_LAST_ACTIVE_WRITE_MS,
): boolean {
  if (!lastActiveAt) return true
  const at = Date.parse(lastActiveAt)
  return !Number.isFinite(at) || now - at >= everyMs
}
