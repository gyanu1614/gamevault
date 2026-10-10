import { SITE_URL } from '@/config/site'
import { CHUNK_SIZE, normaliseUrls, postIndexNowChunk, type ChunkResult } from '@/lib/seo/indexnow/submit'

/**
 * The SEO change log (seo_url_events). Every trigger that changes a public page
 * — a price job, an admin publish or edit, a blog post, a listing change, a
 * trend-radar approval, a deploy that changed a static page's date — writes a
 * row here instead of pinging IndexNow itself. recordAndFlush tries the
 * delivery at once (so a page usually reaches IndexNow within seconds) and the
 * hourly /api/cron/seo-indexnow run (.github/workflows/seo-hourly.yml) retries whatever failed, in batches, so a
 * ping is never lost to a slow endpoint or a failed request (it used to be
 * fire-and-forget from inside each action).
 *
 * The Google check (hourly batches) fills gsc_state / last_inspected on the same rows.
 */
export interface UrlEventRow {
  id: number
  url: string
  reason: string
  attempts: number
}

export interface UrlEventStore {
  insert(rows: { url: string; reason: string }[]): Promise<void>
  /** Pending rows whose next attempt is due, oldest first. */
  due(limit: number, nowIso: string): Promise<UrlEventRow[]>
  markSent(ids: number[], atIso: string): Promise<void>
  markRetry(updates: { id: number; attempts: number; nextAttemptAt: string; error: string }[]): Promise<void>
  markFailed(updates: { id: number; attempts: number; error: string }[]): Promise<void>
}

/** Attempts before a row is given up as `failed` (then it shows on /admin/seo). */
export const MAX_ATTEMPTS = 6
const BACKOFF_MINUTES = [5, 30, 120, 720, 1440]
/** Rows per cron run: 5 chunks of 100 at most. */
export const SEND_LIMIT = 500

export function nextAttemptDelayMinutes(attemptsSoFar: number, retryAfterSec: number | null): number {
  const backoff = BACKOFF_MINUTES[Math.min(attemptsSoFar, BACKOFF_MINUTES.length) - 1] ?? BACKOFF_MINUTES[0]
  return retryAfterSec ? Math.max(Math.ceil(retryAfterSec / 60), BACKOFF_MINUTES[0]) : backoff
}

/** IndexNow answers 422 when a URL does not belong to the host and 400 for a malformed body: retrying cannot help. */
const PERMANENT = new Set([400, 422])

/**
 * Log page changes. Paths or absolute URLs on the site; anything else is
 * dropped. Awaited by every caller, never throws: a failed write is returned
 * and logged, and must not break the publish that triggered it.
 */
export async function recordUrlEvents(
  paths: string[],
  reason: string,
  opts: { store?: UrlEventStore; siteUrl?: string; log?: (line: string) => void } = {},
): Promise<{ recorded: number; error: string | null }> {
  const log = opts.log ?? ((line: string) => console.error(line))
  const { urls } = normaliseUrls(paths, opts.siteUrl ?? SITE_URL)
  if (urls.length === 0) return { recorded: 0, error: null }
  try {
    const store = opts.store ?? (await defaultStore())
    await store.insert(urls.map((url) => ({ url, reason })))
    return { recorded: urls.length, error: null }
  } catch (e) {
    const error = (e as Error).message
    log(`[seo-events] reason=${reason} could not log ${urls.length} URL(s): ${error}`)
    return { recorded: 0, error }
  }
}

export interface SendResult {
  sent: number
  retried: number
  failed: number
  /** Distinct URLs posted. */
  urls: number
  skipped: 'not-production' | null
}

/** Send the due rows: each URL once, CHUNK_SIZE per request; each row is marked by its chunk's outcome. */
export async function sendDueEvents(deps: {
  store: UrlEventStore
  post?: (urls: string[]) => Promise<ChunkResult>
  now: string
  production: boolean
  limit?: number
}): Promise<SendResult> {
  const result: SendResult = { sent: 0, retried: 0, failed: 0, urls: 0, skipped: null }
  if (!deps.production) return { ...result, skipped: 'not-production' }
  const post = deps.post ?? ((urls: string[]) => postIndexNowChunk(urls))

  const due = await deps.store.due(deps.limit ?? SEND_LIMIT, deps.now)
  const rowsByUrl = new Map<string, UrlEventRow[]>()
  for (const row of due) rowsByUrl.set(row.url, [...(rowsByUrl.get(row.url) ?? []), row])
  const urls = [...rowsByUrl.keys()]
  result.urls = urls.length

  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE)
    const rows = chunk.flatMap((u) => rowsByUrl.get(u)!)
    const outcome = await post(chunk)
    if (outcome.ok) {
      await deps.store.markSent(rows.map((r) => r.id), deps.now)
      result.sent += rows.length
      continue
    }
    const error = outcome.error ?? `HTTP ${outcome.status}`
    const giveUp = rows.filter((r) => PERMANENT.has(outcome.status ?? 0) || r.attempts + 1 >= MAX_ATTEMPTS)
    const retry = rows.filter((r) => !giveUp.includes(r))
    if (giveUp.length > 0) {
      await deps.store.markFailed(giveUp.map((r) => ({ id: r.id, attempts: r.attempts + 1, error })))
      result.failed += giveUp.length
    }
    if (retry.length > 0) {
      await deps.store.markRetry(
        retry.map((r) => {
          const minutes = nextAttemptDelayMinutes(r.attempts + 1, outcome.retryAfterSec)
          return { id: r.id, attempts: r.attempts + 1, nextAttemptAt: new Date(Date.parse(deps.now) + minutes * 60_000).toISOString(), error }
        }),
      )
      result.retried += retry.length
    }
  }
  return result
}

type Db = any

/** The table-backed store (service role). */
export function supabaseUrlEventStore(db: Db): UrlEventStore {
  const check = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message)
  }
  return {
    async insert(rows) {
      check(await db.from('seo_url_events').insert(rows))
    },
    async due(limit, nowIso) {
      const { data, error } = await db
        .from('seo_url_events')
        .select('id, url, reason, attempts')
        .eq('indexnow_status', 'pending')
        .lte('next_attempt_at', nowIso)
        .order('next_attempt_at')
        .order('id')
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []) as UrlEventRow[]
    },
    async markSent(ids, atIso) {
      // attempts += 1 per row would need one update each; the count is only
      // informative for sent rows, so the batch write keeps it at its value.
      for (let i = 0; i < ids.length; i += 200) {
        check(
          await db
            .from('seo_url_events')
            .update({ indexnow_status: 'sent', sent_at: atIso, last_error: null })
            .in('id', ids.slice(i, i + 200)),
        )
      }
    },
    async markRetry(updates) {
      for (const u of updates) {
        check(
          await db
            .from('seo_url_events')
            .update({ attempts: u.attempts, next_attempt_at: u.nextAttemptAt, last_error: u.error })
            .eq('id', u.id),
        )
      }
    },
    async markFailed(updates) {
      for (const u of updates) {
        check(
          await db
            .from('seo_url_events')
            .update({ indexnow_status: 'failed', attempts: u.attempts, last_error: u.error })
            .eq('id', u.id),
        )
      }
    },
  }
}

/**
 * Log, then try to deliver right away: the due rows (these and any earlier
 * ones still pending) go out now, in production. A failed delivery leaves them
 * pending for the hourly /api/cron/seo-indexnow retry — the log row is the
 * guarantee, the immediate attempt is only for speed. Awaited, never throws.
 */
export async function recordAndFlush(
  paths: string[],
  reason: string,
  opts: { store?: UrlEventStore; production?: boolean; now?: string; post?: (urls: string[]) => Promise<ChunkResult> } = {},
): Promise<{ recorded: number; error: string | null; sent: number }> {
  const store = opts.store ?? (await defaultStore().catch(() => undefined))
  const logged = await recordUrlEvents(paths, reason, { store })
  if (!store || logged.recorded === 0) return { ...logged, sent: 0 }
  try {
    const { isProductionDeployment } = await import('@/lib/env/deployment')
    const r = await sendDueEvents({
      store,
      post: opts.post,
      now: opts.now ?? new Date().toISOString(),
      production: opts.production ?? isProductionDeployment(),
      limit: 200,
    })
    return { ...logged, sent: r.sent }
  } catch (e) {
    console.error(`[seo-events] immediate delivery failed (the hourly retry picks it up): ${(e as Error).message}`)
    return { ...logged, sent: 0 }
  }
}

async function defaultStore(): Promise<UrlEventStore> {
  const { createServiceRoleClient } = await import('@/lib/supabase/service')
  return supabaseUrlEventStore(createServiceRoleClient())
}
