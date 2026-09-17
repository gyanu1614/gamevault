/**
 * Degradation seam for the /founding server-side data fan-out.
 *
 * Why this exists — JAVASCRIPT-NEXTJS-5, 16 Sep 2026: a founder opened their
 * magic link in the Google app's in-app webview, one fetch failed with
 * WebKit's opaque "TypeError: Load failed", and the whole page escalated to
 * app/error.tsx. They saw the global "Something Went Wrong" screen, with
 * "Browse Marketplace" as the way out, instead of their own HQ.
 *
 * getFoundingHqData() fans out across several INDEPENDENT Supabase reads:
 * the founder row, their join number, the seller journey, the profile chip,
 * the progress counter. Most are enrichment — if the journey lookup fails the
 * page can still greet the founder and show their spot. Treating every read as
 * load-bearing is what turned one dropped request into a dead page.
 *
 * Two seams, so each read states what it is:
 *   optional() — enrichment: degrade to a fallback, keep rendering.
 *   required() — load-bearing: rethrow as a FoundingDataError so the route
 *                boundary (app/founding/error.tsx) can offer a real retry.
 *
 * Not `server-only`: the seam is pure so it can be unit tested directly.
 */

import { isNetworkError } from '@/lib/utils/safe-background'

/**
 * A /founding read that genuinely could not be satisfied.
 *
 * `retryable` distinguishes a transport failure (worth a Try Again button)
 * from a real defect (retrying will fail identically). `cause` keeps the
 * original error so Sentry still reports the true stack.
 */
export class FoundingDataError extends Error {
  readonly retryable: boolean

  constructor(label: string, cause: unknown) {
    const retryable = isNetworkError(cause)
    super(
      retryable
        ? `Founding HQ: could not reach the database for "${label}"`
        : `Founding HQ: failed to load "${label}"`,
      { cause },
    )
    this.name = 'FoundingDataError'
    this.retryable = retryable
  }
}

/**
 * An enrichment read: its failure costs one detail, never the page.
 *
 * Always resolves. A transport failure logs a warning (expected on mobile and
 * in in-app webviews); anything else logs an error — but both degrade.
 */
export async function optional<T>(
  read: () => Promise<T> | T,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn(`[${label}] unreachable, rendering without it:`, error)
    } else {
      console.error(`[${label}] failed, rendering without it:`, error)
    }
    return fallback
  }
}

/**
 * A load-bearing read: without it there is no page worth rendering.
 *
 * Rethrows as a FoundingDataError so app/founding/error.tsx renders the
 * "couldn't load — retry" state in the route's own surface, instead of the
 * global boundary dropping the founder out of their onboarding.
 */
export async function required<T>(read: () => Promise<T> | T, label: string): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error(`[${label}] failed — surfacing a retryable error state:`, error)
    throw new FoundingDataError(label, error)
  }
}
