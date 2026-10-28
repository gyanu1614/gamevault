/**
 * PURCHASES_ENABLED — the marketplace-wide buying kill-switch.
 *
 * OFF (default) while payments are pre-launch: every buy path shows "Buying
 * Opens Soon" + notify-me, and order creation / payment initiation is hard-
 * blocked server-side (createCheckout, retryOrderPayment).
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

/*
 * There is no wallet top-up. The old one was a Stripe checkout and went with
 * Stripe (2026-10-24). Do not add one back without legal sign-off: letting
 * buyers prepay our payables ledger drifts toward e-money / custody under the
 * commercial-agent model (BTCPay design session, 2026-09-03). The wallet is
 * filled only by refunds and credit, through the ledger RPCs.
 */
