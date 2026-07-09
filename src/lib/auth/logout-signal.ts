/**
 * Cross-component logout signal.
 *
 * Problem: when the navbar signs the user out while they're on a protected
 * page (e.g. /account/orders), Supabase flips the auth state to logged-out
 * *in place*. The account layout's "redirect to /login if !user" effect then
 * fires and pushes to /login?redirect=... — competing with the navbar's own
 * "go home" redirect and briefly flashing the login screen + a collapsed page.
 *
 * Fix: the navbar raises this flag the instant the user clicks Log Out, and
 * the protected layouts skip their login-redirect while it's raised. The
 * navbar is the single owner of where a logging-out user lands (home). The
 * flag auto-clears shortly after, so a genuine session expiry (not a
 * user-initiated logout) still redirects to login as before.
 *
 * Module-level (not React state) on purpose: it must be readable synchronously
 * from a different component's effect within the same tick, before any
 * re-render propagates.
 */

let loggingOut = false
let clearTimer: ReturnType<typeof setTimeout> | null = null

/** Raise the flag — called by the navbar right before supabase.signOut(). */
export function beginLogout() {
  loggingOut = true
  if (clearTimer) clearTimeout(clearTimer)
  // Safety auto-clear: a logout navigation settles well within this window.
  // If something goes wrong we don't want the flag stuck on (which would
  // suppress a legitimate later session-expiry redirect).
  clearTimer = setTimeout(() => {
    loggingOut = false
    clearTimer = null
  }, 4000)
}

/** True while a user-initiated logout is in flight. */
export function isLoggingOut() {
  return loggingOut
}
