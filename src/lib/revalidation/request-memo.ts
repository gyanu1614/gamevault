import * as React from 'react'

/**
 * Per-render memo (React `cache()`): one render calls the wrapped loader once
 * per argument list, however many components or helpers ask for it.
 *
 * Why it matters on top of unstable_cache: Next 14.2 SKIPS the data cache for
 * an unstable_cache called inside another unstable_cache's callback, and for
 * every on-demand ISR revalidation (next/dist/server/web/spec-extension/
 * unstable-cache.js). In those renders each call is a database read, so the
 * shared sets (paused / test sellers, value catalogue) are memoised per render.
 *
 * React.cache exists at runtime in Next 14's bundled React, but the project's
 * stable @types/react only declares it in canary typings and plain React 18.3
 * (vitest, scripts) has none — read it off the namespace with a pass-through
 * fallback. Outside a render it does not memoise (each call runs).
 */
export const requestMemo: <T extends (...args: any[]) => any>(fn: T) => T =
  (React as any).cache ?? ((fn: any) => fn)
