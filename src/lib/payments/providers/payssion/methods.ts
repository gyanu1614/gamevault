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
 *   pm_id NOT FOUND (docs stale): ideal_nl, upi_in, neosurf, bankcard_in;
 *     sofort discontinued 2025-09-30.
 * 2026-09-07 expansion (rate sheet + account manager reply): paysafecard was
 * approved for our account; the other additions are non-highlighted
 * ("direct integration") methods on the official rate sheet. All of them are
 * UNPROBED on our account — re-run the enable probe before deploying, and
 * pull any pm_id that still fails create with 491.
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
  // Paysafecard: account manager SAYS it's enabled (email 2026-09-07) but the
  // live probe still gets 491 (2026-09-08) — she's been asked to flip it on
  // for app "DropMarket". Uncomment once a probe returns 200. Sheet terms:
  // 12.5% fee, refunds NOT supported provider-side (refunds → wallet credit);
  // feePercent null until the owner decides on a buyer surcharge.
  // paysafecard: { pmId: 'paysafecard', label: 'Paysafecard', kind: 'voucher',
  //   expiryMinutes: VOUCHER_MINUTES, feePercent: null,
  //   coverage: 'Europe, UK, CA & AU' },
  pix_br: {
    pmId: 'pix_br',
    label: 'Pix',
    kind: 'instant', // real-time bank transfer
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Brazil',
  },
  maya_ph: {
    pmId: 'maya_ph',
    label: 'Maya',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Philippines',
  },
  qr_ph: {
    pmId: 'qr_ph',
    label: 'QR Ph',
    kind: 'instant', // national QR standard — any PH bank/wallet app
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Philippines',
  },
  qris_id: {
    pmId: 'qris_id',
    label: 'QRIS',
    kind: 'instant', // national QR standard — any ID bank/wallet app
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Indonesia',
  },
  spei_mx: {
    pmId: 'spei_mx',
    label: 'SPEI',
    kind: 'instant', // near-real-time interbank transfer
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Mexico',
  },
  pse_co: {
    pmId: 'pse_co',
    label: 'PSE',
    kind: 'instant', // bank-redirect rail
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Colombia',
  },
  webpay_cl: {
    pmId: 'webpay_cl',
    label: 'WebPay',
    kind: 'instant', // bank/card redirect rail
    expiryMinutes: INSTANT_MINUTES,
    feePercent: null,
    coverage: 'Chile',
  },
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
