/**
 * The SAB import's failure handling: which errors are worth retrying, and the
 * batch splitter used when a batch keeps timing out. Moved out of
 * import-sab-market-json.mjs (which re-exports both) to keep that file small.
 */

const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

/**
 * PostgREST/Postgres SQLSTATEs that will NEVER succeed on retry, whatever HTTP
 * status they arrive under. The import endpoint wraps an RPC failure in its own
 * 500, so status alone cannot distinguish "the database is busy" from "this
 * statement is invalid" — the SQLSTATE can.
 *
 * ROUTE-013: 21000 is the one that bit us. A full-refresh function did an
 * unqualified DELETE, safe-update mode rejected it, the edge function reported
 * it as a 500, and the retry loop dutifully re-sent the same doomed statement
 * four times before failing — turning a clear, instant error into four minutes
 * of identical failures.
 */
const NON_RETRYABLE_SQLSTATES = [
  "21000", // cardinality_violation — incl. "DELETE requires a WHERE clause"
  "42501", // insufficient_privilege
  "42703", // undefined_column
  "42P01", // undefined_table
  "42883", // undefined_function
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "22P02", // invalid_text_representation
  "PGRST", // PostgREST's own schema-cache / request errors (PGRST2xx, PGRST1xx)
];

export function isRetryableImportError(error) {
  const status = Number(error?.status ?? 0);
  const text = `${error?.details ?? ""} ${error?.message ?? ""}`;

  // Decide on the error's IDENTITY before its HTTP status. A permanent schema or
  // constraint failure is permanent even when it surfaces as a 500.
  if (NON_RETRYABLE_SQLSTATES.some((code) => text.includes(code))) return false;
  if (/requires a where clause/i.test(text)) return false;
  // ROUTE-017: a malformed listing_url throws the bare `TypeError: Invalid URL`
  // from new URL() — no status, no SQLSTATE — so it reached the final
  // `status >= 500` and was rejected only by luck (0 >= 500 is false). Wrapped
  // in a 5xx, or under 408/429, the same unparseable row would be re-sent 4x.
  // Keyed on the phrase, not on "url": a statement timeout whose text happens
  // to contain a URL must still retry.
  if (/invalid url/i.test(text)) return false;

  // Transient by identity, whatever the status.
  if (
    text.includes("57014") ||
    /statement timeout/i.test(text) ||
    /gateway timeout|fetch failed|socket|ECONNRESET|EAI_AGAIN|ETIMEDOUT/i.test(
      text,
    )
  ) {
    return true;
  }

  // 4xx is the client's fault and will not fix itself — never retry it. (408
  // and 429 are the two exceptions: both explicitly mean "try again".)
  if (status === 408 || status === 429) return true;
  if (status >= 400 && status < 500) return false;

  // A bare 5xx with no recognisable SQLSTATE is assumed transient (the gateway
  // or the database was briefly unavailable).
  return status >= 500;
}


/**
 * A batch that still fails after its retries (Values Pricing Daily, Oct 7 +
 * Oct 9: batch 53/54 of ~55 timed out — 504 / 546 / lock timeout — on every
 * attempt, the gateway giving up while the insert kept its locks, and the
 * whole SAB import died so the reprice never ran) is split in half and sent
 * again, down to `minSize` listings. A piece that still fails is skipped and
 * reported, never quietly: the rest of the day's crawl lands and is priced.
 * Only transient failures split; a permanent one (bad data, 4xx) still stops
 * the import. `send(part, label)` is sendBatchWithRetry (retries come first).
 */
/**
 * @param {Array<{ external_listing_id?: string }>} listings
 * @param {(part: any[], label: string) => Promise<any>} send
 * @param {{ label?: string, minSize?: number, pauseMs?: number }} [options]
 */
export async function sendSplitting(listings, send, { label = 'batch', minSize = 25, pauseMs = 20000 } = {}) {
  const responses = []
  const skipped = []
  async function go(part, name) {
    try {
      responses.push(await send(part, name))
    } catch (error) {
      if (!isRetryableImportError(error)) throw error
      if (part.length <= minSize) {
        skipped.push({ label: name, size: part.length, error: error.message, ids: part.map((l) => l.external_listing_id) })
        return
      }
      const mid = Math.ceil(part.length / 2)
      console.warn(`\n${name} still failing (${error.message}) — splitting into ${mid} + ${part.length - mid}…`)
      // Let the timed-out attempt finish and release its locks first.
      if (pauseMs) await pause(pauseMs)
      await go(part.slice(0, mid), `${name}a`)
      await go(part.slice(mid), `${name}b`)
    }
  }
  await go(listings, label)
  return { responses, skipped }
}
