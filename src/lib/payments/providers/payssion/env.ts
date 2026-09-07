/**
 * Payssion adapter environment + constants.
 *
 * Payssion is our fiat local-payment-methods rail (vouchers/APMs: Paysafecard,
 * iDEAL, UPI, …) — hosted redirect + notify webhook, MD5 signatures. NO global
 * Visa/MC (cards come from a separate acquirer later).
 *
 * Env is read at CALL TIME (functions, not module-load constants) so tests can
 * inject values — same convention as the CoinGate/BTCPay adapters.
 *
 * PAYSSION_TESTMODE=1 targets the sandbox (separate sandbox account +
 * `payssion_test` pm_id; note the sandbox is plain http). Live keys are
 * `live_…`-prefixed; we are on a live account, so production is the default.
 */

export function payssionBase(): string {
  const test = (process.env.PAYSSION_TESTMODE ?? '').toLowerCase()
  return test === '1' || test === 'true'
    ? 'http://sandbox.payssion.com'
    : 'https://www.payssion.com'
}

export function payssionApiKey(): string | undefined {
  return process.env.PAYSSION_API_KEY
}

export function payssionSecretKey(): string | undefined {
  return process.env.PAYSSION_SECRET_KEY
}

/**
 * Public origin for the notify webhook URL (same source order as CoinGate).
 *
 * GUARD: in production, refuse a tunnel/localhost origin. The notify_url is
 * baked into the Payssion charge at creation time — if a stale ngrok/localhost
 * value slips into a prod build, EVERY payment silently 404s its webhook and
 * orders never complete. Fail loudly at create time instead, so it's caught
 * before a real buyer pays. (Dev is untouched — ngrok tunnels are expected there.)
 */
export function payssionPublicApiUrl(): string {
  const origin =
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'

  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview')

  if (isProd && /ngrok|localhost|127\.0\.0\.1|\.local\b/i.test(origin)) {
    throw new Error(
      `[Payssion] Refusing to create a payment: notify_url origin "${origin}" is a ` +
        `tunnel/localhost host in production. Set PUBLIC_API_URL (or NEXT_PUBLIC_APP_URL) ` +
        `to the public domain (https://dropmarket.gg) so payment webhooks are delivered.`,
    )
  }

  return origin
}

export function assertPayssionConfigured(): void {
  if (!payssionApiKey()) throw new Error('[Payssion] PAYSSION_API_KEY is not set')
  if (!payssionSecretKey()) throw new Error('[Payssion] PAYSSION_SECRET_KEY is not set')
}
