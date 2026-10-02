/** Wires key → token → throttled client for the two entrypoints. */

import { createTokenProvider, loadServiceAccountKey, resolveKeyPath } from './auth'
import { createGscClient } from './client'
import { GSC_SITE, REQUESTS_PER_SECOND } from './config'
import { createThrottle } from './throttle'
import type { Clock, FetchLike } from './types'

export interface RuntimeOptions {
  env: Record<string, string | undefined>
  home: string
  fetch: FetchLike
  clock: Clock
  readFile?: (path: string) => string
}

export function createRuntime({ env, home, fetch, clock, readFile }: RuntimeOptions) {
  const keyPath = resolveKeyPath(env, home)
  const key = loadServiceAccountKey(keyPath, readFile)
  const tokens = createTokenProvider({ key, fetch, now: clock.now })
  const throttle = createThrottle({
    minIntervalMs: Math.ceil(1000 / REQUESTS_PER_SECOND),
    now: clock.now,
    sleep: clock.sleep,
  })
  const client = createGscClient({
    fetch,
    getToken: tokens.getToken,
    throttle,
    sleep: clock.sleep,
    siteUrl: GSC_SITE,
  })
  return { client, keyPath }
}

/** Local calendar day as YYYY-MM-DD (the report files are dated by the operator's day). */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
