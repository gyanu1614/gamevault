/**
 * When AuthProvider should re-read the signed-in user's profile and seller
 * status (2026-10-20 usage audit, 4.1).
 *
 * supabase-js fires onAuthStateChange far more often than the profile changes:
 * INITIAL_SESSION right after initAuth loaded it, SIGNED_IN on every tab switch
 * or phone unlock (its visibility handler re-runs session recovery), and
 * TOKEN_REFRESHED about hourly per tab. Each one re-read `profiles` (every
 * column) and `seller_applications`. A profile loaded for the same user within
 * the window is reused; a different user, an empty state, an old load or a
 * USER_UPDATED event always reloads. Pure.
 */

/** A profile younger than this is reused across auth events. */
export const PROFILE_FRESH_MS = 5 * 60 * 1000

export type ProfileLoad = { userId: string; at: number } | null

export function shouldReloadProfile(
  event: string,
  userId: string,
  lastLoad: ProfileLoad,
  now: number = Date.now(),
): boolean {
  if (event === 'USER_UPDATED') return true
  if (!lastLoad || lastLoad.userId !== userId) return true
  return now - lastLoad.at >= PROFILE_FRESH_MS
}
