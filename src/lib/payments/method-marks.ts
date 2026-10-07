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
