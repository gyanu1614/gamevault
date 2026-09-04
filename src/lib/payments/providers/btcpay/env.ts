/**
 * BTCPay Server adapter environment + constants.
 *
 * Self-hosted BTCPay instance (pay.dropmarket.gg) driven over the Greenfield
 * API. One store, watch-only xpub — the server can WATCH payments but never
 * spend (keys live in the owner's cold wallet), which is why refunds are
 * ledger credits, never on-chain sends.
 *
 * Env is read at CALL TIME (functions, not module-load constants) so the
 * route/runtime can set vars after import, and tests can inject them —
 * same convention as the CoinGate adapter.
 */

/** Base URL of the BTCPay instance, no trailing slash (e.g. https://pay.dropmarket.gg). */
export function btcpayBase(): string {
  return (process.env.BTCPAY_URL ?? '').replace(/\/+$/, '')
}

/** Greenfield API key (store-scoped: btcpay.store.canviewinvoices +
 *  cancreateinvoice are sufficient — never grant server-admin). */
export function btcpayApiKey(): string | undefined {
  return process.env.BTCPAY_API_KEY
}

/** The store id the marketplace charges through. */
export function btcpayStoreId(): string | undefined {
  return process.env.BTCPAY_STORE_ID
}

/** Webhook HMAC secret (set on the store's webhook; BTCPay signs the raw
 *  body with it → BTCPay-Sig header). */
export function btcpayWebhookSecret(): string | undefined {
  return process.env.BTCPAY_WEBHOOK_SECRET
}

/** Invoice payment window (minutes). Rate locks at creation; after this the
 *  invoice expires and the buyer gets a fresh one via Retry Payment. */
export const BTCPAY_INVOICE_EXPIRY_MINUTES = 30

/** How long BTCPay keeps watching an EXPIRED invoice for a late payment
 *  (minutes). Late payments surface as additionalStatus=PaidLate → admin
 *  queue, never an automatic order confirmation. */
export const BTCPAY_MONITORING_MINUTES = 90

export function assertBtcpayConfigured(): void {
  if (!btcpayBase()) throw new Error('[BTCPay] BTCPAY_URL is not set')
  if (!btcpayApiKey()) throw new Error('[BTCPay] BTCPAY_API_KEY is not set')
  if (!btcpayStoreId()) throw new Error('[BTCPay] BTCPAY_STORE_ID is not set')
}
