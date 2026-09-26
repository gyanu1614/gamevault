/**
 * Recorded Payssion enable-probe results (checkout B4, 2026-09-24 — see
 * docs/payments/eu-methods-probe.md). Every pm_id in the registry MUST have a
 * fixture here whose `resultCode` is 200: `eu-methods.test.ts` makes the
 * "registry entry ⇒ probe-confirmed 200" invariant (docs/checkout.md §9.1)
 * executable, and drives the adapter's createCharge through the recorded
 * response shape per method.
 *
 * Each probe created a real pending transaction on the production Payssion
 * account with the docs 6-field signature and cancelled it in the same run
 * (`cancelState`). Shapes are verbatim: the create answer is
 * `{ todo: 'redirect', redirect_url, transaction: { transaction_id, state,
 * amount, currency }, result_code: 200 }`; a refusal is
 * `{ result_code, description }` with no transaction.
 *
 * Amounts are the probe's, NOT the sheet's minimums; `description` is the
 * provider's exact refusal text. Keep this file free of secrets and URLs.
 */

export interface PayssionProbeFixture {
  /** ISO date of the probe run. */
  probedAt: string
  pmId: string
  currency: string
  amount: string
  resultCode: number
  /** Present only on a 200 (a transaction was minted). */
  transactionId?: string
  state?: string
  /** true when the answer carried a redirect_url (a checkout page exists). */
  redirect: boolean
  /** State after our POST /payment/cancel; every minted probe was cancelled. */
  cancelState?: string
  /** Provider refusal text, verbatim, for non-200 answers. */
  description?: string
  /** Where a pre-B4 result comes from when the raw answer was not archived. */
  source?: string
}

const DAY = '2026-09-24'
const ok = (pmId: string, currency: string, amount: string, transactionId: string): PayssionProbeFixture => ({
  probedAt: DAY, pmId, currency, amount, resultCode: 200, transactionId, state: 'pending', redirect: true, cancelState: 'cancelled',
})

/** Pre-B4 methods: probed live 2026-09-06 / 2026-09-08 (docs/checkout.md §7,
 *  methods.ts header) — 200 with a redirect, $0.90 USD, cancelled — but the
 *  raw answers were not archived, so no transaction id is recorded. Re-probe
 *  and replace these with full entries the next time the account changes. */
const LEGACY_DOCS = 'docs/checkout.md §7 — live probe, response not archived'
const legacy = (pmId: string, probedAt: string): PayssionProbeFixture => ({
  probedAt, pmId, currency: 'USD', amount: '0.90', resultCode: 200, state: 'pending', redirect: true, cancelState: 'cancelled', source: LEGACY_DOCS,
})

/** Keyed by pm_id; the FIRST 200 entry is the canonical fixture for that method. */
export const PAYSSION_PROBE_FIXTURES: Record<string, PayssionProbeFixture[]> = {
  boleto_br: [legacy('boleto_br', '2026-09-06')],
  oxxo_mx: [legacy('oxxo_mx', '2026-09-06')],
  gcash_ph: [legacy('gcash_ph', '2026-09-06')],
  pix_br: [legacy('pix_br', '2026-09-08')],
  maya_ph: [legacy('maya_ph', '2026-09-08')],
  qr_ph: [legacy('qr_ph', '2026-09-08')],
  qris_id: [legacy('qris_id', '2026-09-08')],
  spei_mx: [legacy('spei_mx', '2026-09-08')],
  pse_co: [legacy('pse_co', '2026-09-08')],
  webpay_cl: [legacy('webpay_cl', '2026-09-08')],
  // Control (known-good, deliberately not wired): same shape as every pass below.
  bancontact_be: [ok('bancontact_be', 'USD', '0.90', 'A924330388794071')],
  trustly: [ok('trustly', 'USD', '0.90', 'A924331177608005'), ok('trustly', 'EUR', '0.90', 'A924332530524378')],
  blik_pl: [ok('blik_pl', 'USD', '0.90', 'A924331231397665'), ok('blik_pl', 'PLN', '4.00', 'A924332547374151')],
  p24_pl: [ok('p24_pl', 'USD', '0.90', 'A924331261445910')],
  eps_at: [
    ok('eps_at', 'USD', '2.00', 'A924332480053295'),
    { probedAt: DAY, pmId: 'eps_at', currency: 'USD', amount: '0.90', resultCode: 417, redirect: false,
      description: 'The amount of eps must be more than 1.00 EUR. You were trying to pay 0.90 USD(0.81 EUR).' },
  ],
  mbway_pt: [
    ok('mbway_pt', 'USD', '2.00', 'A924332498531945'),
    { probedAt: DAY, pmId: 'mbway_pt', currency: 'USD', amount: '0.90', resultCode: 417, redirect: false,
      description: 'The amount of MB Way must be more than 1.00 EUR. You were trying to pay 0.90 USD(0.81 EUR).' },
  ],
  bancomatpay_it: [ok('bancomatpay_it', 'USD', '0.90', 'A924331321474827')],
  payu_cz: [ok('payu_cz', 'USD', '0.90', 'A924331339458202'), ok('payu_cz', 'CZK', '25.00', 'A924332816311707')],
  paysafecard: [
    ok('paysafecard', 'USD', '0.90', 'A924331506425170'),
    // Above the sheet's €250 cap and still accepted: the cap is OURS to enforce.
    ok('paysafecard', 'USD', '320.00', 'A924332837453275'),
  ],
  // Not a pm_id (the B3 fee-row key was wrong; renamed to bancomatpay_it).
  bancomat_it: [
    { probedAt: DAY, pmId: 'bancomat_it', currency: 'USD', amount: '0.90', resultCode: 405, redirect: false, description: 'bancomat_it pm_id not found' },
  ],
}

/** pm_ids that must never enter the registry (owner rule, docs/checkout.md §7). */
export const NEVER_WIRE_PM_IDS = ['skrill', 'payu_pl', 'multibanco_pt', 'bancomat_it'] as const

/** The canonical passing fixture for a pm_id, or null. */
export function passingProbe(pmId: string): PayssionProbeFixture | null {
  return PAYSSION_PROBE_FIXTURES[pmId]?.find((f) => f.resultCode === 200 && f.redirect && (!!f.transactionId || !!f.source)) ?? null
}

/** The create-API answer a passing probe recorded, re-shaped for a mocked fetch. */
export function fixtureCreateResponse(f: PayssionProbeFixture): Record<string, unknown> {
  if (f.resultCode !== 200) return { result_code: f.resultCode, description: f.description ?? '' }
  return {
    todo: 'redirect',
    redirect_url: `https://www.payssion.com/checkout/${f.transactionId}`,
    transaction: { transaction_id: f.transactionId, state: f.state ?? 'pending', amount: f.amount, currency: f.currency },
    result_code: 200,
  }
}
