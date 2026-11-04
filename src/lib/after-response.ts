import { waitUntil } from '@vercel/functions'

/**
 * Run work the caller should not wait for (a seller's email, a search-engine
 * ping). The response goes out now and Vercel keeps the function alive until the
 * work ends. A failure is logged, never thrown.
 *
 * Not for what an action promises its caller: a decision, an audit row or a
 * cache refresh stay before the return. Work here must not need the session: it
 * runs after the request ended, so use the service role.
 */
export function afterResponse(label: string, work: () => Promise<unknown>): void {
  waitUntil(
    Promise.resolve()
      .then(work)
      .catch((err) => console.error(`[${label}]`, err)),
  )
}
