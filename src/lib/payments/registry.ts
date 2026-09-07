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
import { btcpayProvider } from '@/lib/payments/providers/btcpay'
import { payssionProvider } from '@/lib/payments/providers/payssion'
import { isPayssionMethod } from '@/lib/payments/providers/payssion/methods'

const REGISTRY: Record<string, PaymentProvider> = {
  [fakeProvider.name]: fakeProvider,
  [coinGateProvider.name]: coinGateProvider,
  [btcpayProvider.name]: btcpayProvider,
  [payssionProvider.name]: payssionProvider,
}

/**
 * The provider NEW charges are created with (webhooks stay per-provider, so a
 * cutover never strands in-flight orders on the old provider). Env-switched:
 * PAYMENT_PROVIDER=btcpay for the self-hosted cutover; defaults to coingate
 * until the BTCPay instance is live.
 */
export function activePaymentProviderName(): string {
  return process.env.PAYMENT_PROVIDER ?? 'coingate'
}

/**
 * Per-METHOD provider routing — since Payssion, "which provider" is a property
 * of the payment method the buyer picked, not one global switch:
 *   · a Payssion pm_id (paysafecard / ideal_nl / upi_in / …) → 'payssion'
 *   · anything else (crypto coins, no method given)          → the env-active
 *     provider (btcpay in production)
 * Webhooks stay on per-provider routes, so mixed providers never cross wires.
 */
export function providerNameForMethod(paymentMethodId?: string | null): string {
  if (isPayssionMethod(paymentMethodId)) return 'payssion'
  return activePaymentProviderName()
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
