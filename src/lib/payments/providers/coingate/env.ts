/**
 * CoinGate adapter environment + constants.
 *
 * Sandbox and live are SEPARATE environments with SEPARATE credentials — a
 * live token silently fails in sandbox and vice-versa (the #1 CoinGate gotcha).
 * Build/test entirely against sandbox first.
 *
 * Env is read at CALL TIME (functions, not module-load constants) so that the
 * route/runtime can set vars after import, and tests can inject them.
 */

export function coinGateEnv(): 'sandbox' | 'live' {
  return process.env.COINGATE_ENV === 'live' ? 'live' : 'sandbox'
}

export function coinGateBase(): string {
  return coinGateEnv() === 'live'
    ? 'https://api.coingate.com/v2'
    : 'https://api-sandbox.coingate.com/v2'
}

/** API token (per environment). Absent → adapter cannot make live calls (tests skip). */
export function coinGateApiToken(): string | undefined {
  return process.env.COINGATE_API_TOKEN
}

/** Secret used to sign/verify the per-order callback token embedded in callback_url. */
export function coinGateCallbackSecret(): string | undefined {
  return process.env.COINGATE_CALLBACK_TOKEN_SECRET
}

/** Public base URL for building callback/success/cancel URLs.
 *  PUBLIC_API_URL lets dev point callbacks at an ngrok tunnel; in prod it
 *  is usually unset, so fall back to the deployment URL BEFORE localhost —
 *  the old localhost-only fallback silently sent every CoinGate payment
 *  webhook to http://localhost:3000 (orders stuck 'pending' forever). */
export function publicApiUrl(): string {
  const origin =
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'

  // GUARD: never bake a tunnel/localhost callback into a prod charge — it 404s
  // the webhook and strands the order 'pending'. Fail loudly at create time.
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview')

  if (isProd && /ngrok|localhost|127\.0\.0\.1|\.local\b/i.test(origin)) {
    throw new Error(
      `[CoinGate] Refusing to create a payment: callback origin "${origin}" is a ` +
        `tunnel/localhost host in production. Set PUBLIC_API_URL (or NEXT_PUBLIC_APP_URL) ` +
        `to the public domain (https://dropmarket.gg).`,
    )
  }

  return origin
}

/** Settlement currency — EUR, our base/ledger currency. */
export const COINGATE_RECEIVE_CURRENCY = 'EUR'

export function assertCoinGateConfigured(): void {
  if (!coinGateApiToken()) {
    throw new Error('[CoinGate] COINGATE_API_TOKEN is not set (per-environment token from the CoinGate dashboard).')
  }
}
