/**
 * Request pacing and retry for the Search Console APIs.
 *
 * URL Inspection allows 600 queries/min and 2,000/day per property. Pacing
 * one request per 250 ms (4/s = 240/min) keeps the per-minute limit out of
 * play; the daily limit is a hard stop, never a retry.
 */

/** An HTTP failure from Google. status 0 = the request never got a response. */
export class GscHttpError extends Error {
  readonly status: number
  readonly retryAfterMs?: number

  constructor(status: number, message: string, opts: { retryAfterMs?: number } = {}) {
    super(message)
    this.name = 'GscHttpError'
    this.status = status
    this.retryAfterMs = opts.retryAfterMs
  }
}

/** The daily quota is spent; retrying today cannot succeed. */
export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuotaExhaustedError'
  }
}

export interface ThrottleOptions {
  minIntervalMs: number
  now: () => number
  sleep: (ms: number) => Promise<void>
}

/**
 * One shared schedule for every concurrent caller: each `wait()` reserves the
 * next free slot synchronously, so N workers still produce one request per
 * `minIntervalMs`. Idle time is not banked into a burst.
 */
export function createThrottle({ minIntervalMs, now, sleep }: ThrottleOptions) {
  let nextSlot = 0
  return {
    async wait(): Promise<void> {
      const start = Math.max(now(), nextSlot)
      nextSlot = start + minIntervalMs
      const delay = start - now()
      if (delay > 0) await sleep(delay)
    },
  }
}

/** Retry-After as delta-seconds or an HTTP date → milliseconds, else undefined. */
export function parseRetryAfter(header: string | null | undefined, now: number): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

export interface BackoffOptions {
  maxRetries?: number
  baseMs?: number
  maxMs?: number
  sleep: (ms: number) => Promise<void>
  /** 0..1; the delay is scaled by 0.5 + 0.5 × random() so retries de-synchronise. */
  random?: () => number
}

const RETRY_AFTER_CAP_MS = 300_000

function isRetryable(err: unknown): err is GscHttpError {
  return err instanceof GscHttpError && (err.status === 0 || err.status === 429 || err.status >= 500)
}

const DAILY_QUOTA = /per day|daily/i

export async function withBackoff<T>(fn: () => Promise<T>, opts: BackoffOptions): Promise<T> {
  const { maxRetries = 6, baseMs = 1000, maxMs = 60_000, sleep, random = Math.random } = opts
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetryable(err)) throw err
      if (err.status === 429 && DAILY_QUOTA.test(err.message)) {
        throw new QuotaExhaustedError(err.message)
      }
      if (attempt >= maxRetries) throw err
      const exponential = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + 0.5 * random())
      await sleep(err.retryAfterMs != null ? Math.min(err.retryAfterMs, RETRY_AFTER_CAP_MS) : exponential)
    }
  }
}
