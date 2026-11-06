/**
 * A seller has two balances and no more (owner, 2026-11-06): Available, which they can
 * withdraw, and Pending, every sale that isn't theirs yet. Pending is orders still in
 * progress plus completed ones inside the short wait before release.
 */
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { SellerEarningsSummary } from '@/lib/wallet/reads'

export interface WalletBalances {
  available: number
  /** Null when its read failed: show a dash, never a false $0.00. */
  pending: number | null
  pendingNote: string
}

const money = (n: number) => `$${n.toFixed(2)}`

export function pendingBalance(overview: WalletOverview | null, earnings: SellerEarningsSummary | null): number | null {
  return overview && earnings ? earnings.pendingSales + overview.pending : null
}

export function walletBalances(args: { overview: WalletOverview; earnings: SellerEarningsSummary | null; timeZone?: string }): WalletBalances {
  const { overview, earnings, timeZone } = args
  return {
    available: Math.max(0, overview.available + overview.wallet),
    pending: pendingBalance(overview, earnings),
    pendingNote:
      overview.pending > 0 && overview.nextMaturityAt
        ? `Next available on ${new Date(overview.nextMaturityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })}`
        : 'From sales not yet completed',
  }
}

/** Money stopped from moving, said once under the balances. Null when nothing is. */
export function balanceWarning(overview: WalletOverview): string | null {
  if (overview.negative) return 'Your balance is below zero after a refund. New sales bring it back up first.'
  if (overview.frozen > 0) return `${money(overview.frozen)} is waiting on an open dispute. It moves on once the dispute is resolved.`
  return null
}
