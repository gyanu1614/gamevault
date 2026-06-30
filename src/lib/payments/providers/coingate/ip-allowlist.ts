/**
 * CoinGate callback IP allowlist (verification step 1).
 *
 * CoinGate publishes its callback source IPs at GET /v2/ips-v4 (one IP per
 * line, public). We fetch + cache them and reject any callback not from the
 * list. The cache is refreshed on a TTL so a CoinGate IP change is picked up
 * without a deploy.
 */

import { coinGateBase } from './env'

const TTL_MS = 60 * 60 * 1000 // 1 hour
let cache: { ips: Set<string>; fetchedAt: number } | null = null

/** Fetch the current allowlist (cached). Pass a fetch impl for tests. */
export async function getAllowedIps(
  now: number,
  fetchImpl: typeof fetch = fetch
): Promise<Set<string>> {
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return cache.ips
  }
  const res = await fetchImpl(`${coinGateBase()}/ips-v4`)
  if (!res.ok) {
    // If refresh fails but we have a stale cache, keep using it (fail-safe for
    // a transient CoinGate outage); otherwise surface the error.
    if (cache) return cache.ips
    throw new Error(`[CoinGate] ips-v4 fetch failed: ${res.status}`)
  }
  const text = await res.text()
  const ips = new Set(
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  )
  cache = { ips, fetchedAt: now }
  return ips
}

/** Is `ip` in the (cached) CoinGate allowlist? */
export async function isAllowedIp(
  ip: string | undefined,
  now: number,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!ip) return false
  const ips = await getAllowedIps(now, fetchImpl)
  return ips.has(ip)
}

/** Test helper: reset the module cache. */
export function __resetIpCache(): void {
  cache = null
}
