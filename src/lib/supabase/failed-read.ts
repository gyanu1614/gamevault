/**
 * A public read that fails throws. It never comes back looking like "no data".
 *
 * supabase-js answers every failure with `{ data: null, error }` and turns even
 * a thrown network error into that shape, and most readers treat null as
 * "nothing there". So a database outage used to be saved as an empty page or a
 * 404 for as long as the page stayed cached (2026-11-05). Vercel keeps the last
 * good page only when a rebuild FAILS, and a 404 counts as a success.
 *
 * A throw is what makes it fail: Next rethrows it out of a static render, and
 * unstable_cache stores nothing. The cost is that a page never rendered before
 * shows the error page during an outage; every page with a saved copy stays up.
 */

/** Answers the database gives on purpose, which are not failures. */
const NOT_FAILURES = new Set([
  'PGRST116', // .single() found no row, the normal "not found" on a public page
  'PGRST103', // a range past the last page
])

const RETRY_DELAY_MS = 300

export class PublicReadError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'PublicReadError'
    this.status = status
    this.code = code
  }
}

/**
 * First line of any catch on a public read path, so the catch keeps handling
 * what it was written for and a failed read still gets out. By name, not
 * instanceof: Next bundles server code per layer, so there can be two copies
 * of this class in one process.
 */
export function rethrowFailedRead(e: unknown): void {
  if ((e as { name?: unknown } | null | undefined)?.name === 'PublicReadError') throw e
}

type Answer = { error?: { message?: string; code?: string } | null; status?: number }

function throwIfFailed<T extends Answer>(answer: T): T {
  const error = answer?.error
  if (!error || (error.code && NOT_FAILURES.has(error.code))) return answer
  throw new PublicReadError(error.message || 'Public read failed', answer.status ?? 0, error.code)
}

function isQueryBuilder(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { then?: unknown; select?: unknown }
  return typeof v.then === 'function' || typeof v.select === 'function'
}

/** Every step of a query chain stays strict, and awaiting it is where it throws. */
function strictQuery<Q extends object>(query: Q): Q {
  return new Proxy(query, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown
      if (typeof value !== 'function') return value
      if (prop === 'then') {
        return (onDone?: (a: Answer) => unknown, onFail?: (e: unknown) => unknown) =>
          Promise.resolve(target as unknown as PromiseLike<Answer>).then(throwIfFailed).then(onDone, onFail)
      }
      return (...args: unknown[]) => {
        const next = (value as (...a: unknown[]) => unknown).apply(target, args)
        return isQueryBuilder(next) ? strictQuery(next) : next
      }
    },
  })
}

/**
 * The client with its reads made strict: `.from()` and `.rpc()` throw
 * PublicReadError on a failure. createAnonClient already does this; a public
 * read through any other client wraps that client here.
 */
export function strictReads<C extends object>(client: C): C {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown
      if ((prop !== 'from' && prop !== 'rpc') || typeof value !== 'function') return value
      return (...args: unknown[]) => strictQuery((value as (...a: unknown[]) => object).apply(target, args))
    },
  })
}

/**
 * One more try for a read that hit a server error or a dropped connection, so
 * one slow answer costs neither a page nor a whole release build. GET and HEAD
 * only: an rpc is a POST and may write. A 4xx would only fail the same way.
 *
 * The second try carries a signal because React hands the first answer back
 * for an identical fetch in the same render, and skips that only for a signal.
 * Resolves `fetch` per call: Next patches the global after module load.
 */
export const fetchWithReadRetry: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return fetch(input, init)
  try {
    const res = await fetch(input, init)
    if (res.status < 500) return res
  } catch {
    // Dropped connection: the second try decides.
  }
  await new Promise((done) => setTimeout(done, RETRY_DELAY_MS))
  return fetch(input, { ...init, signal: init?.signal ?? new AbortController().signal })
}
