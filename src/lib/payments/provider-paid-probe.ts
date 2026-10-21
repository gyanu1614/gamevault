/**
 * "Has Payssion already taken the money for this order?" — asked before a
 * pending order is cancelled or shown as unpaid.
 *
 * Payssion sends the buyer back to us BEFORE its webhook lands. With the pay
 * page in the same tab (2026-10-16) a buyer can pay, press Back, and press
 * Pay again with another method inside that gap; superseding then would
 * cancel an order whose money is already on its way. One authoritative
 * details call (order-bound signature) answers it. Best-effort: any error or
 * timeout answers false, and the webhook stays the authority either way.
 *
 * Server only. Mocked in tests by module path.
 */
import 'server-only'

import type { PaymentAttempt } from '@/lib/payments/attempts'

/** Payssion states that mean the buyer paid (status-map: completed / paid_more confirm). */
const PAID_STATES = new Set(['completed', 'paid_more'])

export async function payssionPaidAtProvider(
  attempt: Pick<PaymentAttempt, 'provider' | 'provider_charge_id'> | null,
  orderId: string,
): Promise<boolean> {
  if (attempt?.provider !== 'payssion' || !attempt.provider_charge_id) return false
  try {
    const { RETURN_PROBE_TIMEOUT_MS } = await import('@/lib/payments/timeouts')
    const { payssionTransactionState } = await import('@/lib/payments/providers/payssion')
    const state = await payssionTransactionState(attempt.provider_charge_id, orderId, { timeoutMs: RETURN_PROBE_TIMEOUT_MS })
    return PAID_STATES.has(state)
  } catch (e) {
    console.error('[payssionPaidAtProvider] state check failed (treated as unpaid):', e)
    return false
  }
}
