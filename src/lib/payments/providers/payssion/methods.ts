/**
 * Payssion payment-method registry — the v1 method set the checkout selector
 * offers, plus per-method policy the spine needs:
 *
 *  · expiryMinutes — per-method payment window (owner decision 2026-09-06):
 *    instant rails ~1h; voucher rails (buyer walks to a shop / redeems a PIN)
 *    get 48h and are NEVER auto-cancelled on the crypto 30-min clock.
 *  · feePercent — buyer processing-fee override for this method. null →
 *    checkout keeps its default processing fee. Payssion has not quoted
 *    per-method rates yet; plug real numbers in here when they do.
 *
 * pm_ids LIVE-PROBED against our production app 2026-09-06:
 *   ENABLED: boleto_br, oxxo_mx, gcash_ph
 *   exists-but-not-enabled (account manager can enable): paysafecard,
 *     p24_pl, dotpay_pl, alipay_cn, bitcoin
 *   pm_id NOT FOUND (docs stale): ideal_nl, upi_in, neosurf, bankcard_in;
 *     sofort discontinued 2025-09-30.
 * Only ENABLED methods belong in this registry — an entry here is what the
 * checkout selector offers, and an un-enabled pm_id fails create with 491.
 * `payssion_test` is the sandbox-only simulator (guarded by PAYSSION_TESTMODE).
 */

export interface PayssionMethodMeta {
  pmId: string
  label: string
  kind: 'instant' | 'voucher'
  expiryMinutes: number
  /** Buyer processing-fee % override; null → checkout default. */
  feePercent: number | null
  /** Where the method is usable — selector hint only. */
  coverage: string
}

const INSTANT_MINUTES = 60
const VOUCHER_MINUTES = 48 * 60

export const PAYSSION_METHODS: Record<string, PayssionMethodMeta> = {
  boleto_br: {
    pmId: 'boleto_br',
    label: 'Boleto',
    kind: 'voucher', // bank slip paid at banks/lotéricas — takes days
    expiryMinutes: VOUCHER_MINUTES,
    feePercent: null,
    coverage: 'Brazil',
  },
  oxxo_mx: {
    pmId: 'oxxo_mx',
    label: 'OXXO',
    kind: 'voucher', // cash voucher paid at OXXO stores
    expiryMinutes: VOUCHER_MINUTES,
    feePercent: null,
    coverage: 'Mexico',
  },
  gcash_ph: {
    pmId: 'gcash_ph',
    label: 'GCash',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Philippines',
  },
  // Paysafecard: pm exists but is NOT yet enabled for our app (491) — the
  // account manager has been asked; flip this on once the probe returns 200.
  // paysafecard: { pmId: 'paysafecard', label: 'Paysafecard', kind: 'voucher',
  //   expiryMinutes: VOUCHER_MINUTES, feePercent: null, coverage: 'Global' },
  // Sandbox simulator (PAYSSION_TESTMODE only) — lets us run the whole
  // create → redirect → "Mark as Completed" → notify pipeline without money.
  payssion_test: {
    pmId: 'payssion_test',
    label: 'Payssion Test',
    kind: 'instant',
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Sandbox',
  },
}

export function isPayssionMethod(pmId: string | null | undefined): boolean {
  if (!pmId) return false
  // The sandbox simulator only routes in test mode — in production a crafted
  // payssion_test request must fall through to the default provider.
  if (pmId === 'payssion_test') {
    const t = (process.env.PAYSSION_TESTMODE ?? '').toLowerCase()
    return t === '1' || t === 'true'
  }
  return Object.prototype.hasOwnProperty.call(PAYSSION_METHODS, pmId)
}

/** Provider-side expiry for a method, as an ISO timestamp from now. */
export function payssionExpiryIso(pmId: string, now: number = Date.now()): string {
  const meta = PAYSSION_METHODS[pmId]
  const minutes = meta?.expiryMinutes ?? INSTANT_MINUTES
  return new Date(now + minutes * 60 * 1000).toISOString()
}
