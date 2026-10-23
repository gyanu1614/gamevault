/**
 * Payssion payment-method registry — the method set the checkout selector
 * offers, plus per-method policy the spine needs:
 *
 *  · expiryMinutes — per-method payment window (owner decision 2026-09-06):
 *    instant rails ~1h; voucher rails (buyer walks to a shop / redeems a PIN)
 *    get 48h and are NEVER auto-cancelled on the crypto 30-min clock.
 *  · the buyer processing FEE is NOT here (checkout B3 / PAY-023): it lives
 *    in payment_method_fees (one row per pm_id) and is quoted by
 *    buyer_fee_quote through lib/payments/eligibility. This module ships to
 *    the client, so it carries no fee number.
 *  · countries — ISO-3166 alpha-2 codes where the method is the local rail.
 *    Drives the checkout region filter: buyers see matching methods up
 *    front, everything else behind a "More Payment Methods" fold. An
 *    unknown buyer country shows the full list.
 *
 * Entry ORDER here is the checkout display order — keep it sorted by
 * buyer-traffic priority (BR → PH → ID → MY/SG/VN → MX → CO → CL → PE, then
 * Europe, then Middle East & Africa and East Asia). Within a country the bank
 * or wallet rail comes before local cards (cards carry a rolling reserve and
 * chargebacks); worldwide wallets/vouchers (Skrill, paysafecard) come last,
 * so every buyer sees their own country's rails first.
 *
 * Adding a method later = one entry here (probe it first: an un-enabled
 * pm_id fails create with 491) + an icon/copy line in the checkout's
 * METHOD_UI map. Region filtering, ordering, routing, expiry and tests
 * pick it up from this registry automatically.
 *
 * pm_ids LIVE-PROBED against our production app 2026-09-06:
 *   ENABLED: boleto_br, oxxo_mx, gcash_ph
 *   pm_id NOT FOUND (docs stale): ideal_nl, upi_in, neosurf, bankcard_in;
 *     sofort discontinued 2025-09-30.
 * 2026-09-08 probe: pix_br, maya_ph, qr_ph, qris_id, spei_mx, pse_co,
 *   webpay_cl all create fine (200) — live below.
 * 2026-09-24 probe (checkout B4, docs/payments/eu-methods-probe.md): trustly,
 *   blik_pl, p24_pl, eps_at, mbway_pt, bancomatpay_it, payu_cz, paysafecard
 *   all 200 on a USD charge (Payssion converts on its page — no local-currency
 *   charging); eps_at / mbway_pt refuse below €1.00 (417) → min_total_minor on
 *   their fee rows; paysafecard's 491 has cleared. `bancomat_it` is NOT a
 *   pm_id (405) — the real one is bancomatpay_it. The recorded responses are
 *   in ./probe-fixtures.ts and eu-methods.test.ts pins "registry ⇒ probe 200".
 *   NEVER wire payu_pl or multibanco_pt (owner rule).
 * 2026-10-15 probe (USD 2.00, all cancelled): 17 more answer 200 and are
 *   wired below — skrill (owner decision 2026-10-15, reversing the old
 *   "never wire"), kakaopay_kr, paynow_sg, grabpay_sg, fpx_my, touchngo_my,
 *   vietqr_vn, mada_sa, applepay_sa, creditcard_za/br/mx, bcp_pe, twint_ch,
 *   bancontact_be, satispay, mybank. Not enabled (491): naverpay_kr,
 *   alipay_cn, tenpay_cn, payid_au.
 * `payssion_test` is the sandbox-only simulator (guarded by PAYSSION_TESTMODE).
 */

import { MYBANK_COUNTRIES, MYBANK_COVERAGE, SATISPAY_COUNTRIES, SATISPAY_COVERAGE, SKRILL_COUNTRIES } from './method-countries'

export interface PayssionMethodMeta {
  pmId: string
  label: string
  kind: 'instant' | 'voucher'
  expiryMinutes: number
  /** Where the method is usable — selector region chip. */
  coverage: string
  /** ISO-3166 alpha-2 codes for the region filter; [] → never geo-matched. */
  countries: string[]
}

const INSTANT_MINUTES = 60
const VOUCHER_MINUTES = 48 * 60

export const PAYSSION_METHODS: Record<string, PayssionMethodMeta> = {
  pix_br: {
    pmId: 'pix_br',
    label: 'Pix',
    kind: 'instant', // real-time bank transfer
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Brazil',
    countries: ['BR'],
  },
  // Local card rails are named by country: a card issued elsewhere is
  // refused on Payssion's page, so "Cards" alone would mislead a US buyer.
  creditcard_br: {
    pmId: 'creditcard_br',
    label: 'Credit / Debit Card',
    kind: 'instant', // card issued in Brazil
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Brazil',
    countries: ['BR'],
  },
  gcash_ph: {
    pmId: 'gcash_ph',
    label: 'GCash',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Philippines',
    countries: ['PH'],
  },
  maya_ph: {
    pmId: 'maya_ph',
    label: 'Maya',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Philippines',
    countries: ['PH'],
  },
  qr_ph: {
    pmId: 'qr_ph',
    label: 'QR Ph',
    kind: 'instant', // national QR standard — any PH bank/wallet app
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Philippines',
    countries: ['PH'],
  },
  qris_id: {
    pmId: 'qris_id',
    label: 'QRIS',
    kind: 'instant', // national QR standard — any ID bank/wallet app
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Indonesia',
    countries: ['ID'],
  },
  fpx_my: {
    pmId: 'fpx_my',
    label: 'FPX',
    kind: 'instant', // online banking
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Malaysia',
    countries: ['MY'],
  },
  touchngo_my: {
    pmId: 'touchngo_my',
    label: 'TNG eWallet', // the brand's current name (formerly Touch 'n Go eWallet)
    kind: 'instant', // mobile wallet; no provider refunds (sheet)
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Malaysia',
    countries: ['MY'],
  },
  paynow_sg: {
    pmId: 'paynow_sg',
    label: 'PayNow',
    kind: 'instant', // national QR / bank transfer
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Singapore',
    countries: ['SG'],
  },
  grabpay_sg: {
    pmId: 'grabpay_sg',
    label: 'GrabPay',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Singapore',
    countries: ['SG'],
  },
  vietqr_vn: {
    pmId: 'vietqr_vn',
    label: 'VietQR',
    kind: 'instant', // national QR — any VN bank app
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Vietnam',
    countries: ['VN'],
  },
  oxxo_mx: {
    pmId: 'oxxo_mx',
    label: 'OXXO',
    kind: 'voucher', // cash voucher paid at OXXO stores
    expiryMinutes: VOUCHER_MINUTES,
    coverage: 'Mexico',
    countries: ['MX'],
  },
  spei_mx: {
    pmId: 'spei_mx',
    label: 'SPEI',
    kind: 'instant', // near-real-time interbank transfer
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Mexico',
    countries: ['MX'],
  },
  creditcard_mx: {
    pmId: 'creditcard_mx',
    label: 'Credit / Debit Card',
    kind: 'instant', // card issued in Mexico
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Mexico',
    countries: ['MX'],
  },
  boleto_br: {
    pmId: 'boleto_br',
    label: 'Boleto',
    kind: 'voucher', // bank slip paid at banks/lotéricas — takes days
    expiryMinutes: VOUCHER_MINUTES,
    coverage: 'Brazil',
    countries: ['BR'],
  },
  pse_co: {
    pmId: 'pse_co',
    label: 'PSE',
    kind: 'instant', // bank-redirect rail
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Colombia',
    countries: ['CO'],
  },
  webpay_cl: {
    pmId: 'webpay_cl',
    label: 'WebPay',
    kind: 'instant', // bank/card redirect rail
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Chile',
    countries: ['CL'],
  },
  bcp_pe: {
    pmId: 'bcp_pe',
    label: 'BCP',
    // Banco de Crédito del Perú: the buyer gets a reference code and pays it
    // in the BCP app or at an agent, often hours later — a voucher window.
    kind: 'voucher',
    expiryMinutes: VOUCHER_MINUTES,
    coverage: 'Peru',
    countries: ['PE'],
  },
  // ── Europe (checkout B4, probe-verified 2026-09-24) ──────────────────────
  trustly: {
    pmId: 'trustly',
    label: 'Trustly',
    kind: 'instant', // bank-redirect rail (online banking)
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Europe',
    // Trustly's published European bank coverage (its accepted list; Payssion
    // publishes no narrower one). A filter only — never hides a method.
    countries: ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR',
      'HR','HU','IE','IT','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK'],
  },
  blik_pl: {
    pmId: 'blik_pl',
    label: 'BLIK',
    kind: 'instant', // 6-digit code from the buyer's bank app
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Poland',
    countries: ['PL'],
  },
  p24_pl: {
    pmId: 'p24_pl',
    label: 'Przelewy24',
    kind: 'instant', // bank-redirect rail
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Poland',
    countries: ['PL'],
  },
  bancontact_be: {
    pmId: 'bancontact_be',
    label: 'Bancontact',
    kind: 'instant', // Belgian debit card / app
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Belgium',
    countries: ['BE'],
  },
  eps_at: {
    pmId: 'eps_at',
    label: 'EPS',
    kind: 'instant', // bank-redirect rail; Payssion refuses below €1.00 (417)
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Austria',
    countries: ['AT'],
  },
  mbway_pt: {
    pmId: 'mbway_pt',
    label: 'MB Way',
    kind: 'instant', // mobile wallet; Payssion refuses below €1.00 (417)
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Portugal',
    countries: ['PT'],
  },
  bancomatpay_it: {
    pmId: 'bancomatpay_it',
    label: 'BANCOMAT Pay',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Italy',
    countries: ['IT'],
  },
  satispay: {
    pmId: 'satispay',
    label: 'Satispay',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: SATISPAY_COVERAGE,
    countries: SATISPAY_COUNTRIES,
  },
  mybank: {
    pmId: 'mybank',
    label: 'MyBank',
    kind: 'instant', // bank-redirect rail (online banking)
    expiryMinutes: INSTANT_MINUTES,
    coverage: MYBANK_COVERAGE,
    countries: MYBANK_COUNTRIES,
  },
  payu_cz: {
    pmId: 'payu_cz',
    label: 'PayU',
    kind: 'instant', // bank-redirect rail
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Czechia',
    countries: ['CZ'],
  },
  twint_ch: {
    pmId: 'twint_ch',
    label: 'TWINT',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Switzerland',
    countries: ['CH'],
  },
  // ── Middle East & Africa / East Asia (2026-10-15 probe) — regions without
  //    spill: only buyers in the listed country see these. ─────────────────
  mada_sa: {
    pmId: 'mada_sa',
    label: 'Credit / Debit Card',
    kind: 'instant', // mada debit + cards issued in Saudi Arabia
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Saudi Arabia',
    countries: ['SA'],
  },
  applepay_sa: {
    pmId: 'applepay_sa',
    label: 'Apple Pay',
    kind: 'instant', // Apple Pay with a Saudi-issued card
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Saudi Arabia',
    countries: ['SA'],
  },
  creditcard_za: {
    pmId: 'creditcard_za',
    label: 'Credit / Debit Card',
    kind: 'instant', // card issued in South Africa
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'South Africa',
    countries: ['ZA'],
  },
  kakaopay_kr: {
    pmId: 'kakaopay_kr',
    label: 'Kakao Pay',
    kind: 'instant', // mobile wallet
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'South Korea',
    countries: ['KR'],
  },
  // ── Multi-country wallets/vouchers last: a buyer sees their own country's
  //    rails before them. ───────────────────────────────────────────────────
  skrill: {
    pmId: 'skrill',
    label: 'Skrill',
    kind: 'instant', // e-wallet; Payssion holds a 10% / 180-day reserve (docs/checkout.md §7)
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Europe, UK & Switzerland',
    countries: SKRILL_COUNTRIES,
  },
  paysafecard: {
    pmId: 'paysafecard',
    label: 'paysafecard',
    kind: 'voucher', // prepaid PIN — the buyer may need to buy one first
    expiryMinutes: VOUCHER_MINUTES,
    coverage: 'Europe, UK, CA & AU',
    // Sheet terms: 12.5%, cap €250 (enforced by OUR fee row — Payssion accepted
    // $320 at create), no provider refunds (fee row refundable=false → wallet
    // credit only). Accepted list from the account manager (2026-09-07).
    countries: ['AT','AU','BE','BG','CA','CH','CY','CZ','DE','DK','EE','ES',
      'FI','FR','GB','GE','GI','GR','HR','HU','IE','IT','LT','LU','LV','MT',
      'NL','NO','PL','PT','RO','SE','SI','SK'],
  },
  // Sandbox simulator (PAYSSION_TESTMODE only) — lets us run the whole
  // create → redirect → "Mark as Completed" → notify pipeline without money.
  payssion_test: {
    pmId: 'payssion_test',
    label: 'Payssion Test',
    kind: 'instant',
    expiryMinutes: INSTANT_MINUTES,
    coverage: 'Sandbox',
    countries: [],
  },
}

/** Selector-facing methods in display order (the sandbox simulator never
 *  renders as a checkout row). */
export function payssionSelectorMethods(): PayssionMethodMeta[] {
  return Object.values(PAYSSION_METHODS).filter((m) => m.pmId !== 'payssion_test')
}

/**
 * Region filter for the checkout selector. `matched` renders up front,
 * `other` goes behind the "More Payment Methods" fold. An unknown or
 * unparsable buyer country (localhost, missing geo header) matches
 * everything — never strand a buyer behind a wrong guess.
 */
export function splitPayssionMethodsByCountry(
  country: string | null | undefined
): { matched: PayssionMethodMeta[]; other: PayssionMethodMeta[] } {
  const cc = (country ?? '').trim().toUpperCase()
  const all = payssionSelectorMethods()
  if (!/^[A-Z]{2}$/.test(cc)) return { matched: all, other: [] }
  const matched = all.filter((m) => m.countries.includes(cc))
  const other = all.filter((m) => !m.countries.includes(cc))
  return { matched, other }
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
