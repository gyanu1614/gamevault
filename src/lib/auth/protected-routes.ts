/**
 * Protected route prefixes — the SINGLE source of truth.
 *
 * Both the middleware (server-side page gate) and the logout handler
 * (client-side "where do I land after sign-out") import this, so they can
 * never drift apart. Previously each defined its own mismatched list, causing
 * awkward flows (e.g. logging out on /orders refreshed in place, then the
 * middleware bounced you to /login).
 *
 * A path is "protected" if it starts with any of these prefixes. Logged-out
 * users hitting one are redirected to login (middleware); logging out while on
 * one sends you home (logout handler) rather than leaving you on a page you can
 * no longer access.
 *
 * NOTE: this is the AUTHENTICATION gate (must be logged in). Finer-grained
 * authorization (seller-only, admin-only) is enforced separately in the
 * middleware + server actions; see HANDOFF_AUTH_AUDIT.md.
 */
export const PROTECTED_ROUTE_PREFIXES = [
  '/account',
  '/orders',
  '/purchases',
  '/checkout',
  '/cart',
  '/sell',
  '/seller',
  '/wallet',
  '/admin',
] as const

/**
 * True if `pathname` is under a protected prefix.
 *
 * Matches the prefix exactly or at a `/` boundary only — a bare
 * startsWith would swallow sibling public routes (e.g. `/seller`
 * matching `/seller-agreement`, `/sell` matching `/seller-agreement`).
 */
export function isProtectedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return PROTECTED_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
