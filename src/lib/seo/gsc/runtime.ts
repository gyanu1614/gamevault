import { createTokenProvider, loadServiceAccountKey } from '../../../../scripts/lib/gsc/auth'
import { createGscClient } from '../../../../scripts/lib/gsc/client'
import { GSC_SITE, REQUESTS_PER_SECOND } from '../../../../scripts/lib/gsc/config'
import { createThrottle, GscHttpError, QuotaExhaustedError } from '../../../../scripts/lib/gsc/throttle'

import type { GscApi } from './daily'

/**
 * The Search Console client for the server (the daily check cron), built on
 * the same pieces as `pnpm gsc:index-report` (scripts/lib/gsc: signed-JWT
 * auth, one shared 4 req/s throttle, backoff, the 2,000/day quota stop). Read
 * only (webmasters.readonly). The service-account key comes from the env var
 * GSC_SERVICE_ACCOUNT_KEY_B64 (the key JSON, base64) instead of a file; it is
 * never logged.
 */
export function gscApiFromEnv(env: Record<string, string | undefined> = process.env): GscApi | null {
  const b64 = env.GSC_SERVICE_ACCOUNT_KEY_B64
  if (!b64) return null
  const key = loadServiceAccountKey('GSC_SERVICE_ACCOUNT_KEY_B64', () => Buffer.from(b64, 'base64').toString('utf8'))
  const now = () => Date.now()
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
  const tokens = createTokenProvider({ key, fetch, now })
  const throttle = createThrottle({ minIntervalMs: Math.ceil(1000 / REQUESTS_PER_SECOND), now, sleep })
  // A cron has a time budget: at most 2 quick retries (a long Retry-After would outlast the run).
  return createGscClient({ fetch, getToken: tokens.getToken, throttle, sleep, siteUrl: GSC_SITE, backoff: { maxRetries: 2, maxMs: 5_000 } }) as unknown as GscApi
}

/**
 * Stop the run on ANY quota answer. Google's URL Inspection 429 says only
 * "Quota exceeded for sc-domain:…" (no "per day"), so the old check missed it
 * and a run burned ~300 more calls into the wall (2026-10-10). The next hourly
 * run tries again; the day's allowance resets at midnight Pacific.
 */
export const isQuotaError = (e: unknown) =>
  e instanceof QuotaExhaustedError || (e instanceof GscHttpError && e.status === 429 && /quota/i.test(e.message))
