/**
 * Provider registry — resolves a PaymentProvider by name.
 *
 * The webhook route and checkout pass a provider name (from the URL or order's
 * provider_name); this returns the adapter. Adapters register here. CoinGate
 * lands in Phase 4; the fake provider is always available for tests.
 */

import type { PaymentProvider } from '@/lib/payments/types'
import { fakeProvider } from '@/lib/payments/providers/fake'
import { coinGateProvider } from '@/lib/payments/providers/coingate'

const REGISTRY: Record<string, PaymentProvider> = {
  [fakeProvider.name]: fakeProvider,
  [coinGateProvider.name]: coinGateProvider,
  // tazapay:  tazapayProvider,    // ← Phase 7
}

/** Resolve a provider by name, or throw if unknown. */
export function getProvider(name: string): PaymentProvider {
  const p = REGISTRY[name]
  if (!p) {
    throw new Error(`Unknown payment provider: ${name}`)
  }
  return p
}

/** For tests / introspection. */
export function registeredProviders(): string[] {
  return Object.keys(REGISTRY)
}
