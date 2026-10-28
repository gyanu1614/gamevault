/**
 * The Stripe API client — created on FIRST USE, never at import (PR #239).
 * One client per secret key, reused across calls in a warm instance.
 *
 * The API version is pinned: Stripe changes response shapes per version, and
 * the status map reads them. Bump it together with the `stripe` package and
 * re-run the adapter tests.
 */
import 'server-only'

import Stripe from 'stripe'

import { PROVIDER_FETCH_TIMEOUT_MS } from '@/lib/payments/timeouts'
import { assertStripeConfigured, stripeSecretKey } from './env'

/** The version stripe@23.0.0 is built against. */
export const STRIPE_API_VERSION = '2026-09-30.endive'

let cached: { key: string; client: Stripe } | null = null

export function stripeClient(): Stripe {
  assertStripeConfigured()
  const key = stripeSecretKey() as string
  if (cached?.key === key) return cached.client
  const client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    // PAY-016: a hung provider socket must not pin a serverless invocation.
    timeout: PROVIDER_FETCH_TIMEOUT_MS,
    maxNetworkRetries: 1,
    appInfo: { name: 'DropMarket', url: 'https://dropmarket.gg' },
  })
  cached = { key, client }
  return client
}
