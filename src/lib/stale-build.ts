/**
 * Recovery for a tab running JavaScript from an older deploy.
 *
 * After a release, a tab opened before it still has the old webpack runtime.
 * When it loads a chunk from the new build, the module it asks for is not
 * there: webpack throws "Cannot read properties of undefined (reading
 * 'call')" (Safari: "undefined is not an object (evaluating '…call')"), or a
 * ChunkLoadError when the old chunk is gone. Sentry, 2026-09-29: /shop/:slug.
 * A full reload fetches the new HTML and runtime and the page works.
 *
 * The reload happens at most once a minute per tab, recorded in
 * sessionStorage; if the tab can't record it (no storage), it never reloads,
 * so this can't loop. Vercel's Skew Protection prevents the mismatch at the
 * source; this covers tabs it can't.
 */

import { safeSession } from '@/lib/safe-storage'

const KEY = 'dm.stale-build-reload'
const WINDOW_MS = 60_000

const CHUNK_FAILED = [
  /ChunkLoadError/,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
]
// A missing module factory: only counts when it happened inside webpack's
// runtime, so an ordinary "x.call of undefined" bug in app code isn't
// mistaken for a stale tab.
const MISSING_MODULE = /reading 'call'|evaluating '[^']*\.call'/

export function isStaleBuildError(error: unknown): boolean {
  const e = error as { name?: string; message?: string; stack?: string } | null | undefined
  const text = `${e?.name ?? ''} ${e?.message ?? (typeof error === 'string' ? error : '')}`
  if (CHUNK_FAILED.some((re) => re.test(text))) return true
  return MISSING_MODULE.test(text) && /webpack/i.test(e?.stack ?? '')
}

/**
 * Reload the page if `error` comes from a stale build and we haven't just
 * tried. Returns true when a reload was started.
 */
export function reloadOnceForStaleBuild(
  error: unknown,
  reload: () => void = () => window.location.reload(),
  now: number = Date.now(),
): boolean {
  if (!isStaleBuildError(error)) return false
  const last = Number(safeSession.get(KEY) ?? 0)
  if (now - last < WINDOW_MS) return false
  safeSession.set(KEY, String(now))
  // Only reload when the guard actually stuck — otherwise it could loop.
  if (safeSession.get(KEY) !== String(now)) return false
  reload()
  return true
}
