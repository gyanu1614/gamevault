/**
 * Is the configured Supabase stack actually reachable?
 *
 * Integration tests used to gate on "are credentials present?", which was a
 * good enough proxy while .env.local always pointed at a live production
 * stack. Since .env.test points at a LOCAL stack that may simply not be
 * running (`npx supabase start`), credentials can be present and valid while
 * nothing is listening — the test then fails with ECONNREFUSED instead of
 * skipping, which is noise, not signal.
 *
 * Probe once per process and cache: a down stack stays down for the run.
 */
let cached: boolean | null = null

export async function supabaseReachable(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  timeoutMs = 1500,
): Promise<boolean> {
  if (cached !== null) return cached
  if (!url) return (cached = false)

  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    // /auth/v1/health is unauthenticated and present on every stack. Any HTTP
    // answer proves something is listening; the status itself is irrelevant.
    await fetch(new globalThis.URL('/auth/v1/health', url), { signal: ctl.signal })
    clearTimeout(t)
    return (cached = true)
  } catch {
    return (cached = false)
  }
}
