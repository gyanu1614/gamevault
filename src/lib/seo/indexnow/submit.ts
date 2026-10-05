import { SITE_URL } from '@/config/site'
import { isProductionDeployment } from '@/lib/env/deployment'

/**
 * IndexNow: tell Bing, Yandex, Seznam and Naver (and, through Bing, ChatGPT
 * search) that specific URLs changed. ONE module for every section of the site.
 *
 * Rules, each pinned by submit.test.ts:
 *  - production deployments only (dev and preview must not advertise canonical URLs);
 *  - only URLs on the site's own host, de-duplicated, as absolute canonical URLs;
 *  - at most CHUNK_SIZE URLs per request. Bing flagged the old daily 504-URL dump
 *    as "batch mode" and said other new pages were never submitted;
 *  - one log line per chunk (reason, size, HTTP status);
 *  - never throws: a failed ping must never break the action that triggered it.
 *
 * Callers say WHY (`reason`) and pass only URLs whose content really changed;
 * there is no "send everything" entry point. Ownership proof: the key file
 * public/<key>.txt is served from the site root and contains the key verbatim.
 */
export const INDEXNOW_KEY = 'd148151df903b69420ca02e9de02d8be'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const CHUNK_SIZE = 100
const REQUEST_TIMEOUT_MS = 4000

export interface SubmitOptions {
  /** Why these URLs are being submitted ("listing-published", "value-change:adopt-me", ...). */
  reason: string
  fetchImpl?: typeof fetch
  siteUrl?: string
  /** Override the production check (tests). */
  production?: boolean
  log?: (line: string) => void
}

export interface SubmitResult {
  /** URLs accepted by the endpoint. */
  submitted: number
  /** Requests attempted. */
  chunks: number
  failures: number
  skipped: 'not-production' | 'empty' | null
}

/** A submit function, as callers inject it in tests. */
export type SubmitFn = (urls: string[], opts: { reason: string }) => Promise<unknown>

/** Absolute canonical URLs on `siteUrl`, de-duplicated; everything else is rejected. */
export function normaliseUrls(
  input: string[],
  siteUrl: string = SITE_URL,
): { urls: string[]; rejected: string[] } {
  const origin = new URL(siteUrl).origin
  const seen = new Set<string>()
  const rejected: string[] = []
  for (const raw of input) {
    const text = raw.trim()
    if (!text) continue
    let pathname: string
    if (/^https?:\/\//i.test(text)) {
      let parsed: URL
      try {
        parsed = new URL(text)
      } catch {
        rejected.push(raw)
        continue
      }
      if (parsed.origin !== origin) {
        rejected.push(raw)
        continue
      }
      pathname = parsed.pathname
    } else {
      pathname = `/${text.split(/[?#]/)[0].replace(/^\/+/, '')}`
    }
    // Canonical form: no query, no fragment, no trailing slash; the root is the bare origin.
    seen.add(`${origin}${pathname.replace(/\/+$/, '')}`)
  }
  return { urls: [...seen], rejected }
}

export async function submitIndexNow(input: string[], opts: SubmitOptions): Promise<SubmitResult> {
  const result: SubmitResult = { submitted: 0, chunks: 0, failures: 0, skipped: null }
  if (!(opts.production ?? isProductionDeployment())) return { ...result, skipped: 'not-production' }

  const log = opts.log ?? ((line: string) => console.log(line))
  const siteUrl = opts.siteUrl ?? SITE_URL
  const { urls, rejected } = normaliseUrls(input, siteUrl)
  if (rejected.length > 0) {
    log(`[indexnow] reason=${opts.reason} ignored ${rejected.length} URL(s) outside ${new URL(siteUrl).hostname}: ${rejected.slice(0, 3).join(', ')}`)
  }
  if (urls.length === 0) return { ...result, skipped: 'empty' }

  const doFetch = opts.fetchImpl ?? fetch
  const host = new URL(siteUrl).hostname
  const total = Math.ceil(urls.length / CHUNK_SIZE)

  for (let i = 0; i < total; i++) {
    const chunk = urls.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const label = `[indexnow] reason=${opts.reason} chunk=${i + 1}/${total} urls=${chunk.length}`
    result.chunks += 1
    try {
      const res = await doFetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key: INDEXNOW_KEY,
          keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
          urlList: chunk,
        }),
        // Cap the wait so a slow endpoint cannot stall the caller.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      // 200 = accepted, 202 = accepted, key validation pending.
      if (res.status === 200 || res.status === 202) {
        result.submitted += chunk.length
        log(`${label} status=${res.status}`)
      } else {
        result.failures += 1
        log(`${label} status=${res.status} FAILED`)
      }
    } catch (e) {
      result.failures += 1
      log(`${label} status=error FAILED (${(e as Error).message})`)
    }
  }
  return result
}
