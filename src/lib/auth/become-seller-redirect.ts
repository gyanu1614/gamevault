/**
 * "Become a seller" entry points (values-page CTAs, /{game}/sell steps, the
 * sell-choice modal, footer links) all land on one of these routes. An
 * account that already sells has nothing to apply for: send it straight to
 * the listing wizard instead (owner, 2026-10-04). Plain module, edge-safe.
 */

/** Routes whose job is turning a visitor into a seller. */
export const BECOME_SELLER_ROUTES = ['/account/become-seller', '/signup-become-seller', '/early-seller'] as const

export function isBecomeSellerRoute(pathname: string): boolean {
  return BECOME_SELLER_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/**
 * Where an account of this sell_access_kind should go instead of a
 * become-a-seller page, or null to let the page render (buyers, applicants
 * still in the pipeline, admins, unknown).
 */
export function becomeSellerRedirect(kind: string | null | undefined): string | null {
  if (kind === 'seller') return '/sell/new'
  if (kind === 'seller_blocked') return '/account/restrictions'
  return null
}

/** True when the request carries a Supabase auth cookie (skip work for anonymous visitors). */
export function hasSupabaseSessionCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => name.startsWith('sb-') && name.includes('-auth-token'))
}
