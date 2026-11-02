/**
 * The ONE way the daily crawlers talk to Eldorado's public JSON API: a pacer,
 * a throttle rule and a retry rule, shared by every Eldorado request a run
 * makes (SAB, Adopt Me, Murder Mystery 2, Steal an Egg, SAB popularity).
 *
 * WHY (2026-10-28/29). Eldorado tightened its rate limit and answered the SAB
 * crawl with HTTP 429 after ~60 of 420 brainrots (~165 requests in ~110 s),
 * two days running. No crawler code had changed: inside one brainrot the
 * collector fired the SEO mapping, the candidate queries and up to 10 offer
 * pages back to back — bursts of ~12 requests in under 2 s — and its
 * `--delay-ms` only slept BETWEEN brainrots. The 429 threw before the feed was
 * written, so the ~60 brainrots already read were thrown away, nothing was
 * imported, expire/reprice/freshness never ran and SAB prices went stale.
 * The same day, MM2 and Adopt Me walked ~280 and ~1,300 pages at one request
 * per 1.5 s without a single 429: a steady pace is what Eldorado tolerates.
 *
 * So, the same rule the trend radar applies to Roblox (CLAUDE.md, "never retry
 * through a throttle"):
 *   - Pacer: every request starts at least `minIntervalMs` + 0..`jitterMs`
 *     after the previous one, process-wide (slots are reserved synchronously,
 *     so concurrent callers queue too). Idle time is never banked into a burst.
 *   - 429 / 403: wait `Retry-After` (seconds or HTTP date, capped at 120 s) or
 *     a 60 s cool-down, double the interval (capped at 4x), retry the SAME
 *     request once. A second block in a row throws EldoradoBlockedError: the
 *     caller ends its crawl cleanly with what it has. A response that is not a
 *     block resets the count.
 *   - 5xx / network error / timeout: up to 2 retries with backoff, then a
 *     normal error (the caller's own skip rules apply). 404 with `optional`
 *     → null. Any other non-OK → EldoradoHttpError.
 *   - One fixed browser User-Agent. Nothing here rotates user agents, proxies
 *     or anything else that would evade a block.
 *
 * Plain JS ESM with no `@/` imports: the scripts run under plain node (and
 * tsx). Every collaborator (fetch, sleep, clock, random, log) is injectable,
 * so src/test/routes/eldorado-http.test.ts runs without the network.
 */

export const ELDORADO_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/136.0.0.0 Safari/537.36";

/**
 * SAB default: 2.0-2.5 s between request starts (~0.44 req/s). Below the
 * ~0.6 req/s MM2 and Adopt Me sustain daily without a 429, and a third of the
 * ~1.5 req/s (with bursts) that tripped the limit. A ~1,250-request SAB crawl
 * takes ~47 min at this pace (it was ~14 min unpaced).
 */
export const DEFAULT_MIN_INTERVAL_MS = 2000;
export const DEFAULT_JITTER_MS = 500;
/** Cool-down when a block carries no usable Retry-After. */
export const DEFAULT_COOLDOWN_MS = 60_000;
/** Never sleep longer than this on a Retry-After, whatever it asks. */
export const RETRY_AFTER_CAP_MS = 120_000;
/** The second block in a row ends the crawl. */
export const MAX_CONSECUTIVE_BLOCKS = 2;
/** Retries after the first attempt for 5xx / network / timeout. */
export const TRANSIENT_RETRIES = 2;
export const TRANSIENT_BACKOFF_MS = 5000;
export const REQUEST_TIMEOUT_MS = 60_000;

const BLOCK_STATUSES = new Set([403, 429]);
const realSleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Eldorado blocked us twice in a row: stop crawling, keep what was read. */
export class EldoradoBlockedError extends Error {
  // No parameter properties / class fields with TS syntax: plain node.
  constructor({ status, url, blocks, waitedMs }) {
    super(
      `Eldorado returned HTTP ${status} again after a ${Math.round(waitedMs / 1000)}s cool-down ` +
        `(${blocks} blocks in a row); stopped without bypassing the block.`,
    );
    this.name = "EldoradoBlockedError";
    this.status = status;
    this.url = url;
    this.blocks = blocks;
  }
}

/** A non-OK answer that is not a block (after retries, for 5xx). */
export class EldoradoHttpError extends Error {
  constructor(status, url) {
    super(`Eldorado API returned HTTP ${status} for ${url}`);
    this.name = "EldoradoHttpError";
    this.status = status;
    this.url = url;
  }
}

export function isEldoradoBlocked(error) {
  return (
    error instanceof EldoradoBlockedError ||
    (error != null && typeof error === "object" && error.name === "EldoradoBlockedError")
  );
}

/** Retry-After as delta-seconds or an HTTP date → milliseconds, else null. */
export function parseRetryAfter(header, nowMs) {
  if (header == null) return null;
  const text = String(header).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  const date = Date.parse(text);
  return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

async function discardBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // Nothing to free; the response is dropped either way.
  }
}

/**
 * One client per run. `getJson(url, { optional })` is the only request path;
 * `stats()` goes into the run's feed so the pace can be tuned from data.
 */
export function createEldoradoClient({
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  jitterMs = DEFAULT_JITTER_MS,
  maxIntervalMs = minIntervalMs * 4,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  retryAfterCapMs = RETRY_AFTER_CAP_MS,
  maxConsecutiveBlocks = MAX_CONSECUTIVE_BLOCKS,
  transientRetries = TRANSIENT_RETRIES,
  transientBackoffMs = TRANSIENT_BACKOFF_MS,
  timeoutMs = REQUEST_TIMEOUT_MS,
  fetchImpl = (...args) => globalThis.fetch(...args),
  sleep = realSleep,
  now = () => Date.now(),
  random = Math.random,
  log = (message) => console.warn(message),
} = {}) {
  let intervalMs = minIntervalMs;
  let nextSlot = null;
  let consecutiveBlocks = 0;
  let lastCooldownMs = 0;
  const counts = { requests: 0, blocks: 0, transient_retries: 0, cooldown_ms: 0 };

  /** Reserve the next start slot synchronously, then wait for it. */
  async function pace() {
    const t = now();
    const start = nextSlot == null ? t : Math.max(t, nextSlot);
    nextSlot = start + intervalMs + Math.floor(random() * jitterMs);
    if (start > t) await sleep(start - t);
  }

  async function transient(url, reason, attempt) {
    counts.transient_retries += 1;
    const waitMs = transientBackoffMs * attempt;
    log(`  Eldorado ${reason}; retry ${attempt}/${transientRetries} in ${Math.round(waitMs / 1000)}s (${url})`);
    await sleep(waitMs);
  }

  async function getJson(url, { optional = false } = {}) {
    const href = String(url);
    let transientAttempts = 0;
    for (;;) {
      await pace();
      counts.requests += 1;
      let response;
      try {
        response = await fetchImpl(href, {
          headers: {
            accept: "application/json",
            "accept-language": "en-US,en;q=0.9",
            referer: "https://www.eldorado.gg/",
            "user-agent": ELDORADO_USER_AGENT,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (transientAttempts >= transientRetries) {
          throw new Error(`Eldorado request failed (${message}) for ${href}`, { cause: error });
        }
        transientAttempts += 1;
        await transient(href, `request failed (${message})`, transientAttempts);
        continue;
      }

      if (BLOCK_STATUSES.has(response.status)) {
        consecutiveBlocks += 1;
        counts.blocks += 1;
        const retryAfter = parseRetryAfter(response.headers?.get?.("retry-after"), now());
        await discardBody(response);
        const waitMs = retryAfter == null ? cooldownMs : Math.min(retryAfter, retryAfterCapMs);
        if (consecutiveBlocks >= maxConsecutiveBlocks) {
          throw new EldoradoBlockedError({
            status: response.status,
            url: href,
            blocks: consecutiveBlocks,
            waitedMs: lastCooldownMs,
          });
        }
        intervalMs = Math.min(intervalMs * 2, maxIntervalMs);
        log(
          `  Eldorado HTTP ${response.status} (block ${consecutiveBlocks}/${maxConsecutiveBlocks}); ` +
            `cooling down ${Math.round(waitMs / 1000)}s${retryAfter == null ? "" : " (Retry-After)"}, ` +
            `then one request every ${intervalMs} ms`,
        );
        counts.cooldown_ms += waitMs;
        lastCooldownMs = waitMs;
        await sleep(waitMs);
        continue;
      }

      if (response.status >= 500) {
        await discardBody(response);
        if (transientAttempts >= transientRetries) throw new EldoradoHttpError(response.status, href);
        transientAttempts += 1;
        await transient(href, `HTTP ${response.status}`, transientAttempts);
        continue;
      }

      // The server answered normally: whatever throttled us has lifted.
      consecutiveBlocks = 0;

      if (optional && response.status === 404) {
        await discardBody(response);
        return null;
      }
      if (!response.ok) {
        await discardBody(response);
        throw new EldoradoHttpError(response.status, href);
      }
      try {
        return await response.json();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Eldorado returned invalid JSON (HTTP ${response.status}) for ${href}: ${message}`, {
          cause: error,
        });
      }
    }
  }

  return {
    getJson,
    get intervalMs() {
      return intervalMs;
    },
    stats() {
      return {
        requests: counts.requests,
        blocks: counts.blocks,
        transient_retries: counts.transient_retries,
        cooldown_ms: counts.cooldown_ms,
        min_interval_ms: minIntervalMs,
        jitter_ms: jitterMs,
        final_interval_ms: intervalMs,
      };
    },
  };
}
