'use client'

/**
 * The receipt beside the steps: what the seller has, what this withdrawal comes to as
 * they answer, and what happens after they send it. It fills in live, so the sum is
 * always in sight and nothing has to pop up to show it.
 */

import { useEffect, useState } from 'react'
import { BellRingingIcon } from '@phosphor-icons/react/dist/csr/BellRinging'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { IconTile } from '@/components/account/AccountSurface'
import CoinBadge from '@/components/wallet/CoinBadge'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { Row, usd } from './_StepParts'
import { payoutTimeLine } from './_withdraw-model'

export function WithdrawRail({
  overview,
  pending,
  available,
  method,
  amount,
  quote,
  step,
}: {
  overview: WalletOverview | null
  pending: number | null
  available: number
  method: WithdrawalMethod | null
  amount: number
  quote: WithdrawalQuote | null
  step: number
}) {
  // UTC on the server and first draw so they match, then the seller's own time zone.
  const [timeZone, setTimeZone] = useState<string | undefined>('UTC')
  useEffect(() => setTimeZone(undefined), [])

  const nextAt = (overview?.pending ?? 0) > 0 ? overview?.nextMaturityAt : null
  const next = [
    { icon: <MagnifyingGlassIcon size={20} weight="duotone" />, tone: 'trust' as const, title: 'We Review It', body: 'Every withdrawal is reviewed before payment.' },
    { icon: <PaperPlaneTiltIcon size={20} weight="duotone" />, tone: 'money' as const, title: 'We Send It', body: method ? payoutTimeLine(method) : 'Crypto within 24 to 48 hours, Payoneer within 1 to 3 business days, after review.' },
    { icon: <BellRingingIcon size={20} weight="duotone" />, tone: 'speed' as const, title: 'You Get An Email', body: 'The transaction ID appears in your wallet.' },
  ]

  return (
    <aside aria-label="Summary" className="overflow-hidden rounded-lg bg-bg-raised lg:sticky lg:top-24">
      {step < 4 && (
        <div className="hidden p-5 sm:p-6 lg:block">
          <p className="text-[14px] text-text-secondary">Available Balance</p>
          <p className="mt-0.5 text-[30px] font-bold leading-tight tracking-[-0.01em] tabular-nums text-text-primary">{usd(Math.max(0, available))}</p>
          {(pending ?? 0) > 0 && (
            <p className="mt-1 text-[13px] text-text-tertiary">
              {usd(pending ?? 0)} pending{nextAt ? `, next on ${new Date(nextAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })}` : ''}
            </p>
          )}
        </div>
      )}

      {step < 3 && method && (
        <dl className="hidden divide-y divide-white/[0.07] border-t border-white/[0.07] px-5 sm:px-6 lg:block">
          <Row label="Payout Method">
            <span className="inline-flex items-center gap-2">
              <CoinBadge coin={method.coin} methodName={method.method_name} size={18} />
              {method.display_name}
            </span>
          </Row>
          <Row label="Amount">{usd(amount)}</Row>
          <Row label="Fee">-{usd(amount > 0 ? quote?.feeAmount ?? 0 : 0)}</Row>
          <Row label="You Receive">
            <span className="text-[20px] font-bold text-success">{usd(amount > 0 ? quote?.net ?? 0 : 0)}</span>
          </Row>
        </dl>
      )}

      <div className={cn('p-5 sm:p-6', step < 4 && 'lg:border-t lg:border-white/[0.07]')}>
        <h2 className="text-[16px] font-semibold text-text-primary">What Happens Next</h2>
        <ol className="mt-4 space-y-4">
          {next.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <IconTile tone={item.tone} className="h-9 w-9 shrink-0">{item.icon}</IconTile>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary">{item.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
