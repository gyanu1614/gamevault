/**
 * Stripe adapter environment.
 *
 * Stripe is the international card rail (Visa / Mastercard, with Apple Pay
 * and Google Pay through hosted Checkout). Standard account, DropMarket is
 * the merchant; sellers are paid from the DropMarket wallet exactly as with
 * Payssion — no Connect.
 *
 * Env is read at CALL TIME, never at module load: PR #239 removed an old
 * integration whose import-time client broke every build without the key.
 *
 *   STRIPE_SECRET_KEY       sk_live_… / sk_test_… (or a restricted rk_…)
 *   STRIPE_WEBHOOK_SECRET   whsec_… of the endpoint (dashboard, or `stripe listen`)
 */

export function stripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY || undefined
}

export function stripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET || undefined
}

/** Both keys set: the card rail can take a payment and hear about it. */
export function stripeConfigured(): boolean {
  return !!stripeSecretKey() && !!stripeWebhookSecret()
}

export function isStripeTestKey(key: string | undefined = stripeSecretKey()): boolean {
  return !!key && /^(sk|rk)_test_/.test(key)
}

/** The live site (Vercel production). Previews and localhost may use sandbox keys. */
export function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

export function assertStripeConfigured(): void {
  const key = stripeSecretKey()
  if (!key) throw new Error('[Stripe] STRIPE_SECRET_KEY is not set')
  // A sandbox key in production would let test cards buy real items.
  if (isProductionDeploy() && isStripeTestKey(key)) {
    throw new Error('[Stripe] refusing a test key in production — set the live STRIPE_SECRET_KEY')
  }
}
