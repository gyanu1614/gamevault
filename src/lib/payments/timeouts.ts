/**
 * PAY-016 — every outbound provider call carries a deadline.
 *
 * Without one, a hung provider socket pins the serverless invocation for the
 * platform's maximum duration: the checkout action, the webhook route and the
 * buyer's return-route redirect all sat behind bare `fetch` calls. Every
 * provider create / cancel / details / refund fetch now passes
 * `AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS)`; the buyer-facing return
 * route uses the shorter RETURN_PROBE_TIMEOUT_MS and falls through to the
 * awaiting-payment panel when the probe does not answer in time.
 */
export const PROVIDER_FETCH_TIMEOUT_MS = 8_000
export const RETURN_PROBE_TIMEOUT_MS = 4_000

/** Race a promise against a deadline; rejects with a `TimeoutError`-named
 *  error so callers can fall through exactly as they do for a fetch abort. */
export function withTimeout<T>(p: Promise<T>, ms: number, label = 'provider call'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`)
      err.name = 'TimeoutError'
      reject(err)
    }, ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}
