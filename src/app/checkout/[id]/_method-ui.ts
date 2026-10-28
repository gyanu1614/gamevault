/**
 * Checkout method rows — the UI half of a local payment method.
 *
 * Payssion local methods arrive from the PAGE (eligibleMethods → the provider
 * registry + payment_method_fees): pm_ids, labels, region chips, display
 * order, country tags and each method's quoted fee. Hidden / over-cap methods
 * never reach the form. This map only adds what neither the registry nor the
 * fee table should know: the icon and the buyer-facing notes. Adding a method
 * later = registry entry + fee row + one line here (a missing line still
 * renders, with the fallback icon/notes).
 */
import { Barcode, CreditCard, Landmark, QrCode, Smartphone, Store, Wallet, Zap, type LucideIcon } from 'lucide-react'

import type { ClientMethod } from '@/lib/payments/eligibility'
import { PAYMENT_METHOD_MULTI_MARKS, PAYMENT_METHOD_ONDARK, WALLET_MARKS, type MethodMark } from '@/lib/payments/method-marks'
import { flagEmoji } from '@/lib/geo/countries'

export type MethodIcon = LucideIcon

const INSTANT = 'Payment confirms instantly'

const METHOD_UI: Record<string, { Icon: MethodIcon; points: string[] }> = {
  pix_br: { Icon: Zap, points: ['Scan the QR with your bank app', INSTANT] },
  creditcard_br: { Icon: CreditCard, points: ['Pay with a card issued in Brazil', INSTANT] },
  gcash_ph: { Icon: Smartphone, points: ['Approve the payment in GCash', INSTANT] },
  maya_ph: { Icon: Smartphone, points: ['Approve the payment in Maya', INSTANT] },
  qr_ph: { Icon: QrCode, points: ['Scan with any PH bank or wallet app', INSTANT] },
  qris_id: { Icon: QrCode, points: ['Scan with GoPay, OVO, DANA & more', INSTANT] },
  fpx_my: { Icon: Landmark, points: ['Pick your bank on the FPX page', INSTANT] },
  touchngo_my: { Icon: Smartphone, points: ['Approve the payment in TNG eWallet', INSTANT, 'Refunds go to your Store Balance'] },
  paynow_sg: { Icon: QrCode, points: ['Scan the QR with your bank app', INSTANT] },
  grabpay_sg: { Icon: Smartphone, points: ['Approve the payment in the Grab app', INSTANT] },
  vietqr_vn: { Icon: QrCode, points: ['Scan the QR with any Vietnamese bank app', INSTANT] },
  oxxo_mx: { Icon: Store, points: ['Pay cash at any OXXO store', 'Voucher valid 48 hours', 'Clears within a day'] },
  spei_mx: { Icon: Landmark, points: ['Transfer from your bank app', 'Usually clears in minutes'] },
  creditcard_mx: { Icon: CreditCard, points: ['Pay with a card issued in Mexico', INSTANT] },
  boleto_br: { Icon: Barcode, points: ['Pay the slip via bank app or in person', 'Valid 48 hours', 'Clears in 1 to 2 business days'] },
  pse_co: { Icon: Landmark, points: ['Approve in your bank portal', INSTANT] },
  webpay_cl: { Icon: Landmark, points: ['Approve on the WebPay page', INSTANT] },
  bcp_pe: { Icon: Landmark, points: ['Pay the BCP code online or at an agent', 'Valid 48 hours', 'Your order starts once BCP confirms'] },
  // ── Europe — charged in USD; the provider page shows the local amount ──
  trustly: { Icon: Landmark, points: ['Log in to your bank on the Trustly page', INSTANT] },
  blik_pl: { Icon: Smartphone, points: ['Enter the 6-digit code from your bank app', INSTANT] },
  p24_pl: { Icon: Landmark, points: ['Pick your bank on the Przelewy24 page', INSTANT] },
  bancontact_be: { Icon: CreditCard, points: ['Pay with your Bancontact card or app', INSTANT] },
  eps_at: { Icon: Landmark, points: ['Approve in your bank portal', INSTANT] },
  mbway_pt: { Icon: Smartphone, points: ['Approve the payment in the MB Way app', INSTANT] },
  bancomatpay_it: { Icon: Smartphone, points: ['Approve the payment in the BANCOMAT Pay app', INSTANT] },
  satispay: { Icon: Smartphone, points: ['Approve the payment in the Satispay app', INSTANT] },
  mybank: { Icon: Landmark, points: ['Pick your bank on the MyBank page', INSTANT] },
  payu_cz: { Icon: Landmark, points: ['Pick your bank on the PayU page', INSTANT] },
  twint_ch: { Icon: Smartphone, points: ['Approve the payment in the TWINT app', INSTANT] },
  // ── Middle East & Africa / East Asia ──
  mada_sa: { Icon: CreditCard, points: ['Pay with a mada or Saudi-issued card', INSTANT] },
  applepay_sa: { Icon: Smartphone, points: ['Pay with Apple Pay and a Saudi-issued card', INSTANT] },
  creditcard_za: { Icon: CreditCard, points: ['Pay with a card issued in South Africa', INSTANT] },
  kakaopay_kr: { Icon: Smartphone, points: ['Approve the payment in Kakao Pay', INSTANT] },
  // ── Worldwide ──
  // Stripe hosted Checkout. Apple Pay / Google Pay show on Stripe's page when
  // the device has them; not promised here until Stripe confirms them.
  stripe: { Icon: CreditCard, points: ['Pay with a Visa or Mastercard, credit or debit', INSTANT] },
  skrill: { Icon: Wallet, points: ['Log in to your Skrill wallet', INSTANT] },
  paysafecard: { Icon: CreditCard, points: ['Enter your paysafecard PIN', 'Valid 48 hours', 'Refunds go to your Store Balance'] },
}

const FALLBACK_UI = {
  Icon: Landmark,
  points: ['Redirects to a secure payment page', 'Order starts once payment confirms'],
}

export interface LocalMethodRow {
  id: string
  label: string
  region: string
  /** The database's buyer-fee quote for this order (checkout B3). */
  quote: ClientMethod['quote']
  /** Brand marks for the row's logo tiles, drawn for a dark row (public/payments/ondark):
   *  card rails show Visa + Mastercard, others their one mark; empty = the Icon. */
  marks: MethodMark[]
  /** The provider page shows a QR to scan (phones get a "screenshot it" tip). */
  qrPay: boolean
  /** Emoji flag for the region chip: country flag, or 🌍 for multi-country. */
  flag: string
  countries: string[]
  Icon: MethodIcon
  points: string[]
}

export function toRow(m: ClientMethod): LocalMethodRow {
  const ui = METHOD_UI[m.method] ?? FALLBACK_UI
  return {
    id: m.method,
    label: m.label,
    region: m.coverage,
    quote: m.quote,
    marks: PAYMENT_METHOD_MULTI_MARKS[m.method] ?? (PAYMENT_METHOD_ONDARK[m.method] ? [PAYMENT_METHOD_ONDARK[m.method]] : []),
    qrPay: QR_PAY_METHODS.has(m.method),
    flag: m.countries.length === 1 ? flagEmoji(m.countries[0]) : '🌍',
    countries: m.countries,
    Icon: ui.Icon,
    points: ui.points,
  }
}

/**
 * Apple Pay / Google Pay rows (owner 2026-10-27, like Eldorado): above the
 * card row, one per device — Apple Pay where the browser can pay with it,
 * Google Pay elsewhere. Both are the Stripe card method with the same quote;
 * Stripe's page shows the wallet button on top of its card form.
 */
export type WalletAvailability = { applePay: boolean; googlePay: boolean }

const WALLET_ROWS = [
  { id: 'applepay', label: 'Apple Pay', mark: WALLET_MARKS.applepay, points: ['Pay with Apple Pay on the next page', INSTANT] },
  { id: 'googlepay', label: 'Google Pay', mark: WALLET_MARKS.googlepay, points: ['Pay with Google Pay on the next page', INSTANT] },
] as const

export function walletRows(card: LocalMethodRow | null, available: WalletAvailability): LocalMethodRow[] {
  if (!card) return []
  return WALLET_ROWS.filter((w) => (w.id === 'applepay' ? available.applePay : available.googlePay)).map((w) => ({
    ...card,
    id: w.id,
    label: w.label,
    marks: [w.mark],
    Icon: Wallet,
    points: [...w.points],
  }))
}

/** The payment_method_fees method a checkout row pays with (wallet rows → the Stripe card method). */
export function methodIdForRow(rowId: string): string {
  return WALLET_ROWS.some((w) => w.id === rowId) ? 'stripe' : rowId
}

/**
 * The Payment Methods seal under the list (owner 2026-10-27: "small grey
 * logos of Apple Pay, Google Pay and +5 more"): the first few marks this
 * buyer can pay with, then a count of the rest. Apple Pay and Google Pay lead
 * whenever the card rail is open (Stripe's page offers whichever the device
 * has), so the seal doesn't change once the device's wallet is detected. A
 * mark two rails share counts once; a rail with no logo still counts.
 */
export const SEAL_MARK_LIMIT = 4

export function sealMarks(
  input: { cardRail: boolean; rows: LocalMethodRow[]; extra?: MethodMark[] },
  limit: number = SEAL_MARK_LIMIT,
): { shown: MethodMark[]; more: number } {
  const marks = [
    ...(input.cardRail ? [WALLET_MARKS.applepay, WALLET_MARKS.googlepay] : []),
    ...input.rows.flatMap((r) => r.marks),
    ...(input.extra ?? []),
  ]
  const seen = new Set<string>()
  const unique = marks.filter((m) => !seen.has(m.logo) && !!seen.add(m.logo))
  const unmarked = input.rows.filter((r) => r.marks.length === 0).length
  return { shown: unique.slice(0, limit), more: Math.max(0, unique.length - limit) + unmarked }
}

/** The mark slot on a payment row. */
export const MARK_SLOT = { width: 76, height: 30 } as const

/** The mark area inside the logo tile at the right of a payment row (owner 2026-10-21, Eldorado-style rows; slimmer 2026-10-27). */
export const TILE_SLOT = { width: 38, height: 16 } as const

/**
 * One optical size for every brand mark in the row's slot: a square tile
 * stands the full height, a wide wordmark runs longer and lower (height ∝
 * aspect^-0.4), so a GCash wordmark and a Touch 'n Go tile weigh the same.
 */
export function markSize(aspect: number, slot: { width: number; height: number } = MARK_SLOT): { width: number; height: number } {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1
  let height = Math.min(slot.height, slot.height * Math.pow(a, -0.4))
  let width = height * a
  if (width > slot.width) {
    width = slot.width
    height = width / a
  }
  return { width: Math.round(width), height: Math.round(height) }
}

/** Methods whose provider page is a QR to scan from a banking app. */
const QR_PAY_METHODS: ReadonlySet<string> = new Set(['paynow_sg', 'qr_ph', 'qris_id', 'vietqr_vn', 'pix_br'])

/** pm_ids with a METHOD_UI line (tests pin every registry method to one). */
export const METHOD_UI_IDS: readonly string[] = Object.keys(METHOD_UI)
