'use client'

/**
 * The top of the wallet: two balances on two plain cards, the same shape and size
 * (owner, 2026-11-06: "2 types only, available and pending", no green, no gradient, no
 * payout address: that's chosen on the next page). Left the figure, right what goes with it,
 * on one row on phones too: a small Withdraw, not a full-width bar. It's the site's own
 * primary button, with the light sweep and the arrow that nudges.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { ReceiptIcon } from '@phosphor-icons/react/dist/csr/Receipt'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { IconTile } from '@/components/account/AccountSurface'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import Link from '@/components/navigation/AppLink'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import { balanceWarning, walletBalances } from '@/lib/wallet/balances'
import type { SellerEarningsSummary } from '@/lib/wallet/reads'

const usd = (n: number) => `$${n.toFixed(2)}`
/** A read that failed shows this, never a false $0.00. */
const UNKNOWN = '—'

function BalanceCard({ icon, label, figure, aside }: { icon: ReactNode; label: string; figure: string; aside: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bg-raised p-4 sm:flex-nowrap sm:gap-4 sm:p-5 lg:p-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <IconTile className="h-10 w-10 sm:h-12 sm:w-12">{icon}</IconTile>
        <div className="min-w-0">
          <p className="text-[13px] text-text-secondary sm:text-[14px]">{label}</p>
          <p className="mt-0.5 text-[28px] font-bold leading-tight tracking-[-0.01em] tabular-nums text-text-primary sm:text-[30px]">{figure}</p>
        </div>
      </div>
      {aside}
    </div>
  )
}

const NOTE = 'text-[13px] leading-snug text-text-secondary max-sm:w-full sm:max-w-[230px] sm:text-right'

export function Balances({ overview, earnings }: { overview: WalletOverview; earnings: SellerEarningsSummary | null }) {
  // UTC on the server and first draw so they match, then the seller's own time zone.
  const [timeZone, setTimeZone] = useState<string | undefined>('UTC')
  useEffect(() => setTimeZone(undefined), [])

  const { available, pending, pendingNote } = walletBalances({ overview, earnings, timeZone })
  const warning = balanceWarning(overview)
  return (
    <section aria-label="Your Balances">
      <div className="grid gap-3 md:grid-cols-2">
        <BalanceCard
          icon={<WalletIcon size={24} weight="duotone" />}
          label="Available Balance"
          figure={usd(available)}
          aside={
            <Link href="/account/wallet/withdraw" className="group shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
              <BuyButtonFace size="sm" className="sm:h-11 sm:px-5 sm:text-[14px]">Withdraw</BuyButtonFace>
            </Link>
          }
        />
        <BalanceCard
          icon={<HourglassMediumIcon size={24} weight="duotone" />}
          label="Pending Balance"
          figure={pending === null ? UNKNOWN : usd(pending)}
          aside={<p className={NOTE}>{pendingNote}</p>}
        />
      </div>
      {warning && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning-bg px-5 py-3 text-[14px] text-text-primary lg:px-6">
          <WarningCircleIcon size={18} weight="duotone" aria-hidden className="shrink-0 text-warning" />
          {warning}
        </p>
      )}
    </section>
  )
}

/** A buyer has no sales: what they can spend, and what they have spent. */
export function CreditPanel({ credit, spent, completed }: { credit: number; spent: number | null; completed: number | null }) {
  return (
    <section aria-label="Your Store Credit" className="grid gap-3 md:grid-cols-2">
      <BalanceCard
        icon={<WalletIcon size={24} weight="duotone" />}
        label="Store Credit"
        figure={usd(credit)}
        aside={<p className={NOTE}>Use it at checkout with no service fee. To withdraw it, contact support.</p>}
      />
      <BalanceCard
        icon={<ReceiptIcon size={24} weight="duotone" />}
        label="Total Spent"
        figure={spent === null ? UNKNOWN : usd(spent)}
        aside={<p className={NOTE}>{completed === null ? '' : `${completed} completed ${completed === 1 ? 'order' : 'orders'}`}</p>}
      />
    </section>
  )
}
