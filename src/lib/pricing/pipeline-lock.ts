/**
 * Pipeline lock — keep two writers of the SAB pricing tables from overlapping
 * silently.
 *
 * 2026-09-19 20:04Z: an 18-minute manual `pnpm reprice --game=sab --full` from
 * the owner's machine overlapped the scheduled crawl's import. Batch 22 of the
 * import hit HTTP 546, then "canceling statement due to lock timeout" on every
 * retry, and the job died with 10,837 listings crawled and not landed. Neither
 * log said what was holding the lock, or that two writers were running.
 *
 * The primitive is a row with a TTL (sab_pipeline_locks, taken and released
 * through two service-role RPCs — see the migration for why not
 * pg_advisory_lock). This module is the client side: acquire, or wait a
 * bounded time polling, then either run with the lock and ALWAYS release it,
 * or fail with a line that names the holder and since when. The wait exists
 * so the scheduled reprice queues behind a manual one (and vice versa) rather
 * than failing on first contact; the bound exists so a stuck holder produces a
 * red job with a name in it, not a hang.
 *
 * Holders: runSabCorrection (runner, manual --full, the thin correct-prices
 * route) and the collector's import phase, which has its own thin fetch-based
 * copy of this loop (it cannot import app TypeScript). Same RPCs, same name.
 */

import { hostname } from 'node:os'

export const SAB_PIPELINE_LOCK = 'sab-pipeline'

export type LockClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>
}

export type PipelineLockOptions = {
  name: string
  /** Who is asking — shows up in the other side's log line. See defaultHolder. */
  holder: string
  /** How long the lock outlives a holder that never releases it. */
  ttlSeconds: number
  /** How long to queue behind a live holder before giving up. Default 10 min. */
  waitSeconds?: number
  /** Poll interval while waiting. Default 15s. */
  pollSeconds?: number
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  log?: (line: string) => void
}

export class PipelineLockHeldError extends Error {
  constructor(
    readonly lockName: string,
    readonly holder: string,
    readonly since: string,
    readonly until: string,
    readonly waitedSeconds: number,
  ) {
    super(
      `${lockName} is held by ${holder} since ${since} (expires ${until}); ` +
        `gave up after waiting ${waitedSeconds}s. Two writers must not overlap — ` +
        `wait for it to finish, or if it is dead the lock frees itself at expiry.`,
    )
    this.name = 'PipelineLockHeldError'
  }
}

type AcquireRow = {
  acquired: boolean
  holder: string | null
  acquired_at: string | null
  expires_at: string | null
}

/**
 * `<role>:<where>:<pid>` — enough for the other side's log line to say which
 * machine or which Actions run is in the way.
 */
export function defaultHolder(role: string): string {
  const where = process.env.GITHUB_RUN_ID
    ? `gh-run-${process.env.GITHUB_RUN_ID}`
    : hostname()
  return `${role}:${where}:${process.pid}`
}

const defaultSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

async function tryAcquire(
  client: LockClient,
  options: PipelineLockOptions,
): Promise<AcquireRow> {
  const { data, error } = await client.rpc('sab_pipeline_lock_acquire', {
    p_name: options.name,
    p_holder: options.holder,
    p_ttl_seconds: options.ttlSeconds,
  })
  if (error) {
    throw new Error(`sab_pipeline_lock_acquire failed: ${error.message ?? String(error)}`)
  }
  const row = (Array.isArray(data) ? data[0] : data) as AcquireRow | undefined
  if (!row || typeof row.acquired !== 'boolean') {
    throw new Error('sab_pipeline_lock_acquire returned no row')
  }
  return row
}

/**
 * Run `work` holding the lock. Waits up to `waitSeconds` for a live holder,
 * takes over an expired one immediately, and releases in `finally`.
 */
export async function withPipelineLock<T>(
  client: LockClient,
  options: PipelineLockOptions,
  work: () => Promise<T>,
): Promise<T> {
  const waitMs = (options.waitSeconds ?? 600) * 1000
  const pollMs = (options.pollSeconds ?? 15) * 1000
  const sleep = options.sleep ?? defaultSleep
  const now = options.now ?? Date.now
  const log = options.log ?? ((line: string) => console.log(line))

  const startedAt = now()
  let announced = false

  for (;;) {
    const row = await tryAcquire(client, options)
    if (row.acquired) break

    const waited = now() - startedAt
    if (!announced) {
      log(
        `⏳ ${options.name} is held by ${row.holder} since ${row.acquired_at} ` +
          `(expires ${row.expires_at}) — waiting up to ${Math.round(waitMs / 1000)}s ` +
          `for it to finish.`,
      )
      announced = true
    }
    if (waited >= waitMs) {
      throw new PipelineLockHeldError(
        options.name,
        row.holder ?? 'unknown',
        row.acquired_at ?? 'unknown',
        row.expires_at ?? 'unknown',
        Math.round(waited / 1000),
      )
    }
    await sleep(Math.min(pollMs, waitMs - waited))
  }

  if (announced) log(`✅ ${options.name} acquired by ${options.holder} after waiting.`)

  try {
    return await work()
  } finally {
    const { error } = await client.rpc('sab_pipeline_lock_release', {
      p_name: options.name,
      p_holder: options.holder,
    })
    // A failed release is not worth failing the work over: the TTL frees it.
    if (error) {
      log(`⚠️ ${options.name} release failed (${error.message}); it expires on its own.`)
    }
  }
}
