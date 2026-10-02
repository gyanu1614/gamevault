/**
 * sessionStorage that never throws.
 *
 * Some browsers hand the page no storage at all: iOS in-app webviews can
 * expose `window.sessionStorage` as null, Safari private modes and blocked
 * site data throw on access, and a full quota throws on write. Every read and
 * write goes through here, so a page that cannot store simply forgets
 * (in-memory only) instead of crashing — and the app never touches the bare
 * `sessionStorage` global, which is how Sentry's "null is not an object
 * (evaluating 'sessionStorage.getItem')" reports can be told apart as
 * third-party (see instrumentation-client.ts).
 */

function session(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

export const safeSession = {
  get(key: string): string | null {
    try {
      return session()?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      session()?.setItem(key, value)
    } catch {
      /* no storage or full — keep going without it */
    }
  },
  remove(key: string): void {
    try {
      session()?.removeItem(key)
    } catch {
      /* no storage — nothing to remove */
    }
  },
}
