/**
 * Reconciliation & integrity (Phase 5).
 *
 * Two layers:
 *   1. ledgerIntegrityCheck() — provider-INDEPENDENT invariants (ledger
 *      balances to zero per currency, no escrow residue on terminal orders, no
 *      stuck non-terminal orders). Runs now; needs no provider data.
 *   2. reconcileProvider() — compares our provider_float ledger balance against
 *      the provider's reported balance. STUBBED until real settlement data
 *      flows (CoinGate sandbox has no settlements to reconcile yet).
 *
 * Both are meant to run on a schedule (Phase 6 cron) and ALERT, never auto-fix.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'

export interface IntegrityReport {
  ok: boolean
  unbalancedTransactions: unknown[]
  escrowResidueOnTerminalOrders: unknown[]
  stuckNonterminalOrders: number
  checkedAt: string
}

/** Run the provider-independent ledger integrity invariants. */
export async function ledgerIntegrityCheck(): Promise<IntegrityReport> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('ledger_integrity_check')
  if (error) throw new Error(`ledger_integrity_check failed: ${error.message}`)
  const r = data as any
  return {
    ok: r.ok === true,
    unbalancedTransactions: r.unbalanced_transactions ?? [],
    escrowResidueOnTerminalOrders: r.escrow_residue_on_terminal_orders ?? [],
    stuckNonterminalOrders: Number(r.stuck_nonterminal_orders ?? 0),
    checkedAt: r.checked_at,
  }
}

export interface ProviderReconResult {
  provider: string
  reconciled: boolean
  note: string
}

/**
 * reconcileProvider — compare provider_float ledger balance vs the provider's
 * reported balance, per currency. STUB: requires provider.getBalance() + real
 * settlement events, neither of which exists for CoinGate sandbox yet. Wire
 * this when live settlements flow (Phase 7). Returning a clear "not yet"
 * result so the scheduler can log it rather than silently skipping.
 */
export async function reconcileProvider(provider: string): Promise<ProviderReconResult> {
  // TODO(Phase 7): fetch provider.getBalance(), sum provider_float per currency
  // from the ledger, compare, alert + freeze automated payouts on any delta.
  return {
    provider,
    reconciled: false,
    note: 'provider-balance reconciliation not yet implemented (no live settlement data; wire at go-live)',
  }
}
