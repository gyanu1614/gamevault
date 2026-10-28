/**
 * "Has the provider already taken the money for this order?" — asked before a
 * pending order is cancelled or shown as unpaid.
 *
 * Hosted pages (Payssion, Stripe Checkout) send the buyer back to us BEFORE
 * the webhook lands. With the pay page in the same tab (2026-10-16) a buyer
 * can pay, press Back, and press Pay again with another method inside that
 * gap; superseding then would cancel an order whose money is already on its
 * way. One authoritative lookup answers it (Payssion: order-bound details
 * call; Stripe: the Checkout Session). Best-effort: any error or timeout
 * answers false, and the webhook stays the authority either way.
 *
 * Server only. Mocked in tests by module path.
 */
import 'server-only'

import type { PaymentAttempt } from '@/lib/payments/attempts'

/** Payssion states that mean the buyer paid (status-map: completed / paid_more confirm). */
const PAYSSION_PAID = new Set(['completed', 'paid_more'])
/** Stripe session states with money taken or in flight (stripe/status-map). */
const STRIPE_PAID = new Set(['completed', 'processing'])

export async function paidAtProvider(
  attempt: Pick<PaymentAttempt, 'provider' | 'provider_charge_id'> | null,
  orderId: string,
): Promise<boolean> {
  if (!attempt?.provider_charge_id) return false
  if (attempt.provider !== 'payssion' && attempt.provider !== 'stripe') return false
  try {
    const { RETURN_PROBE_TIMEOUT_MS, withTimeout } = await import('@/lib/payments/timeouts')
    if (attempt.provider === 'payssion') {
      const { payssionTransactionState } = await import('@/lib/payments/providers/payssion')
      const state = await payssionTransactionState(attempt.provider_charge_id, orderId, { timeoutMs: RETURN_PROBE_TIMEOUT_MS })
      return PAYSSION_PAID.has(state)
    }
    const { stripeProvider } = await import('@/lib/payments/providers/stripe')
    const { rawStatus } = await withTimeout(stripeProvider.getCharge(attempt.provider_charge_id), RETURN_PROBE_TIMEOUT_MS, 'stripe paid probe')
    return STRIPE_PAID.has(rawStatus)
  } catch (e) {
    console.error(`[paidAtProvider] ${attempt.provider} state check failed (treated as unpaid):`, e)
    return false
  }
}
