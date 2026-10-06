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
