/**
 * PURCHASES_ENABLED — the marketplace-wide buying kill-switch.
 *
 * OFF (default) while payments are pre-launch: every buy path shows "Buying
 * Opens Soon" + notify-me, and order creation / payment initiation is hard-
 * blocked server-side (createCheckout, retryOrderPayment, wallet top-up).
 * Listings stay live and indexable — only transacting is gated.
 *
 * Flip-back is one env var: set NEXT_PUBLIC_PURCHASES_ENABLED=true (and
 * redeploy) once the self-hosted crypto payment page is live.
 *
 * NEXT_PUBLIC_ so client components can read it for UI gates; server actions
 * import the same constant for the authoritative block.
 */
export const PURCHASES_ENABLED = process.env.NEXT_PUBLIC_PURCHASES_ENABLED === 'true'

/** Message returned by gated server actions + shown on gated UI. */
export const PURCHASES_DISABLED_MESSAGE =
  'Buying opens soon — we’re putting the finishing touches on payments.'

/** Primary buy-CTA label — every Buy button reads this so the whole site flips
 *  together. (Buttons still navigate to /checkout, which shows the notify-me
 *  capture while purchases are off.) */
export const BUY_CTA_LABEL = PURCHASES_ENABLED ? 'Buy Now' : 'Buying Opens Soon'

/**
 * WALLET_TOPUP_ENABLED — wallet top-up stays OFF even when purchases flip on.
 *
 * Compliance decision (BTCPay design session, 2026-09-03): letting buyers
 * prepay our payables ledger with crypto drifts toward e-money/custody
 * territory under the commercial-agent model — a solicitor question, not a
 * product default. Also: the top-up path is legacy Stripe (no live keys).
 * Requires its OWN flag on top of PURCHASES_ENABLED to ever come back.
 */
export const WALLET_TOPUP_ENABLED =
  PURCHASES_ENABLED && process.env.NEXT_PUBLIC_WALLET_TOPUP_ENABLED === 'true'

/** Shown by the gated top-up action + any top-up UI while top-up is off. */
export const WALLET_TOPUP_DISABLED_MESSAGE =
  'Wallet top-up is not available yet — you can pay for orders directly at checkout.'
