/**
 * Brand marks for the checkout's payment methods (public/payments, terms in
 * its ATTRIBUTION.md), keyed by Payssion pm_id. Shared by the checkout
 * selector and the "Accepted at Checkout" strip above the footer, so the
 * strip can only ever show methods the checkout really offers.
 * A method with no mark yet renders as its label.
 */
export const PAYMENT_METHOD_LOGOS: Record<string, string> = {
  pix_br: '/payments/pix_br.svg',
  gcash_ph: '/payments/gcash_ph.svg',
  maya_ph: '/payments/maya_ph.svg',
  qr_ph: '/payments/qr_ph.svg',
  qris_id: '/payments/qris_id.svg',
  oxxo_mx: '/payments/oxxo_mx.svg',
  trustly: '/payments/trustly.svg',
  blik_pl: '/payments/blik_pl.svg',
  p24_pl: '/payments/p24_pl.svg',
  eps_at: '/payments/eps_at.svg',
  mbway_pt: '/payments/mbway_pt.svg',
  bancomatpay_it: '/payments/bancomatpay_it.svg',
  payu_cz: '/payments/payu_cz.svg',
  paysafecard: '/payments/paysafecard.svg',
  // 2026-10-15 (sources in public/payments/ATTRIBUTION.md). No legit vector
  // for PayNow (the only "SVG" wraps a PNG) or the country card rails:
  // those rows keep their icon.
  skrill: '/payments/skrill.svg',
  kakaopay_kr: '/payments/kakaopay_kr.svg',
  grabpay_sg: '/payments/grabpay_sg.svg',
  fpx_my: '/payments/fpx_my.svg',
  touchngo_my: '/payments/touchngo_my.svg',
  vietqr_vn: '/payments/vietqr_vn.svg',
  mada_sa: '/payments/mada_sa.svg',
  applepay_sa: '/payments/applepay_sa.svg',
  bcp_pe: '/payments/bcp_pe.svg',
  twint_ch: '/payments/twint_ch.svg',
  bancontact_be: '/payments/bancontact_be.svg',
  satispay: '/payments/satispay.svg',
  mybank: '/payments/mybank.svg',
}

/**
 * On-dark marks for the checkout's glass payment rows (owner 2026-10-19:
 * the logo itself, no white tile, every one the same size). Made from the
 * files above: the white or black card behind the mark removed, near-black
 * and grey ink set white (Grab: its green), the canvas trimmed to the mark.
 * A brand whose own coloured tile is the mark (KakaoPay, Satispay, OXXO,
 * Touch 'n Go, PayU) keeps it. `aspect` is the trimmed width ÷ height, so
 * the row can draw each mark at one optical size.
 */
export const PAYMENT_METHOD_ONDARK: Record<string, { logo: string; aspect: number }> = {
  pix_br: { logo: '/payments/ondark/pix_br.svg', aspect: 2.72 },
  gcash_ph: { logo: '/payments/ondark/gcash_ph.svg', aspect: 4.02 },
  maya_ph: { logo: '/payments/ondark/maya_ph.svg', aspect: 3.32 },
  qr_ph: { logo: '/payments/ondark/qr_ph.svg', aspect: 3.97 },
  qris_id: { logo: '/payments/ondark/qris_id.svg', aspect: 5.65 },
  oxxo_mx: { logo: '/payments/ondark/oxxo_mx.svg', aspect: 1.94 },
  trustly: { logo: '/payments/ondark/trustly.svg', aspect: 3.24 },
  blik_pl: { logo: '/payments/ondark/blik_pl.svg', aspect: 1.96 },
  p24_pl: { logo: '/payments/ondark/p24_pl.svg', aspect: 2.85 },
  eps_at: { logo: '/payments/ondark/eps_at.svg', aspect: 1.59 },
  mbway_pt: { logo: '/payments/ondark/mbway_pt.svg', aspect: 2.02 },
  bancomatpay_it: { logo: '/payments/ondark/bancomatpay_it.svg', aspect: 1.0 },
  payu_cz: { logo: '/payments/ondark/payu_cz.svg', aspect: 1.97 },
  paysafecard: { logo: '/payments/ondark/paysafecard.svg', aspect: 5.29 },
  skrill: { logo: '/payments/ondark/skrill.svg', aspect: 2.85 },
  kakaopay_kr: { logo: '/payments/ondark/kakaopay_kr.svg', aspect: 1.59 },
  grabpay_sg: { logo: '/payments/ondark/grabpay_sg.svg', aspect: 2.72 },
  fpx_my: { logo: '/payments/ondark/fpx_my.svg', aspect: 2.88 },
  touchngo_my: { logo: '/payments/ondark/touchngo_my.svg', aspect: 1.0 },
  vietqr_vn: { logo: '/payments/ondark/vietqr_vn.svg', aspect: 3.33 },
  mada_sa: { logo: '/payments/ondark/mada_sa.svg', aspect: 2.89 },
  applepay_sa: { logo: '/payments/ondark/applepay_sa.svg', aspect: 2.3 },
  bcp_pe: { logo: '/payments/ondark/bcp_pe.svg', aspect: 3.75 },
  twint_ch: { logo: '/payments/ondark/twint_ch.svg', aspect: 2.91 },
  bancontact_be: { logo: '/payments/ondark/bancontact_be.svg', aspect: 1.57 },
  satispay: { logo: '/payments/ondark/satispay.svg', aspect: 1.32 },
  mybank: { logo: '/payments/ondark/mybank.svg', aspect: 1.75 },
}

/** The crypto card's coins, as the checkout lists them. */
export const CHECKOUT_COINS = [
  { key: 'usdt', label: 'USDT', icon: '/crypto/usdt.svg' },
  { key: 'btc', label: 'Bitcoin', icon: '/crypto/btc.svg' },
] as const

/**
 * Single-colour (white) marks for the "Accepted at Checkout" strip, where
 * every method floats on the dark page at one height (owner, 2026-10-06: no
 * white cards, logos only, all alike). Generated from the files above with
 * their frames removed and their canvases trimmed; Bitcoin, Tether and Pix
 * marks from Simple Icons (CC0). A method without a clean mark is set as a
 * wordmark (its name in type) instead.
 */
export const PAYMENT_METHOD_MONO: Record<string, { logo: string } | { wordmark: string }> = {
  pix_br: { logo: '/payments/mono/pix_br.svg' },
  gcash_ph: { logo: '/payments/mono/gcash_ph.svg' },
  maya_ph: { wordmark: 'maya' },
  qr_ph: { logo: '/payments/mono/qr_ph.svg' },
  qris_id: { logo: '/payments/mono/qris_id.svg' },
  oxxo_mx: { wordmark: 'OXXO' },
  spei_mx: { wordmark: 'SPEI' },
  boleto_br: { wordmark: 'Boleto' },
  pse_co: { wordmark: 'PSE' },
  webpay_cl: { wordmark: 'Webpay' },
  trustly: { logo: '/payments/mono/trustly.svg' },
  blik_pl: { logo: '/payments/mono/blik_pl.svg' },
  p24_pl: { logo: '/payments/mono/p24_pl.svg' },
  eps_at: { logo: '/payments/mono/eps_at.svg' },
  mbway_pt: { wordmark: 'MB WAY' },
  bancomatpay_it: { wordmark: 'BANCOMAT Pay' },
  payu_cz: { logo: '/payments/mono/payu_cz.svg' },
  paysafecard: { logo: '/payments/mono/paysafecard.svg' },
}

/** White coin marks for the strip (icon + name). */
export const CHECKOUT_COINS_MONO: Record<string, string> = {
  usdt: '/payments/mono/si-tether.svg',
  btc: '/payments/mono/si-bitcoin.svg',
}
