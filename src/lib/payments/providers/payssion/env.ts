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

/** Public origin for the notify webhook URL (same source order as CoinGate). */
export function payssionPublicApiUrl(): string {
  return (
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  )
}

export function assertPayssionConfigured(): void {
  if (!payssionApiKey()) throw new Error('[Payssion] PAYSSION_API_KEY is not set')
  if (!payssionSecretKey()) throw new Error('[Payssion] PAYSSION_SECRET_KEY is not set')
}
