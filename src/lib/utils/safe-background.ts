/**
 * Degradation helpers for background (non-blocking) client fetches.
 *
 * Why this exists — two Sentry events on 16 Sep 2026, both
 * "TypeError: Load failed" from iPhones:
 *
 *  (A) /founding in a Google-app webview: a server-side load failed and the
 *      route had no boundary of its own, so app/error.tsx swallowed the whole
 *      page — the founder saw "Something Went Wrong" instead of their HQ.
 *  (B) / homepage in Mobile Safari: the navbar called
 *      `getMyStorePaused().then(...)` at mount with no `.catch()`. The
 *      server-action POST rejected on a flaky connection, nothing handled it,
 *      and it surfaced as an unhandled rejection (handled=no).
 *
 * "Load failed" is WebKit's opaque message for *any* network-layer fetch
 * failure: offline, radio handover, DNS, TLS, a webview killing an in-flight
 * request on backgrounding. It is a condition of mobile browsing, not a bug —
 * so a background enrichment that hits it must degrade quietly, not throw.
 *
 * The rule: a fetch whose only job is to ENRICH the UI (a badge, a toggle
 * state, a count) must resolve to a fallback and log. A fetch the page cannot
 * render without belongs in a retryable error state instead — see
 * /founding's FoundingLoadError.
 */

/** Messages browsers use for a network-layer fetch failure, lowercased. */
const NETWORK_ERROR_PATTERNS = [
  'load failed', // WebKit / Safari — the one in both Sentry events
  'failed to fetch', // Chromium / Firefox
  'networkerror', // Firefox ("NetworkError when attempting to fetch resource")
  'network request failed',
  'the internet connection appears to be offline',
]

/**
 * Is this rejection a transport failure rather than a real defect?
 *
 * Used to decide log volume only — `safeBackground` degrades either way, so a
 * false negative here never breaks a page, it just logs louder.
 */
export function isNetworkError(error: unknown): boolean {
  if (error == null) return false

  // An aborted request (navigation away, AbortController, webview teardown) is
  // expected noise, never a defect.
  if (typeof error === 'object' && 'name' in error) {
    const name = String((error as { name?: unknown }).name ?? '')
    if (name === 'AbortError' || name === 'TimeoutError') return true
  }

  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : ''

  const haystack = message.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((p) => haystack.includes(p))
}

/**
 * Run a background fetch that must never break the page.
 *
 * Always resolves: the value on success, `fallback` on any failure. A network
 * failure logs a warning (expected on mobile); anything else logs an error
 * (a real defect worth seeing) — but neither rejects, so a fire-and-forget
 * call site cannot produce an unhandled rejection.
 *
 * @param work     the fetch to attempt; may throw synchronously or reject
 * @param fallback what to resolve to when it fails
 * @param label    a short call-site tag so a degraded load stays traceable
 */
export async function safeBackground<T>(
  work: () => Promise<T> | T,
  fallback: T,
  label = 'background fetch',
): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (isNetworkError(error)) {
      // Expected on mobile networks — degrade quietly.
      console.warn(`[${label}] network unavailable, using fallback:`, error)
    } else {
      // Unexpected: surface it in the console, but still degrade so one
      // failed enrichment never takes the page down.
      console.error(`[${label}] failed, using fallback:`, error)
    }
    return fallback
  }
}
