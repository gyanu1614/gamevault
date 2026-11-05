'use client'

/**
 * The right rail: the sum for this request, or how payouts work until a way of
 * being paid is picked.
 */

import { ArrowLineDownIcon } from '@phosphor-icons/react/dist/csr/ArrowLineDown'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { Loader2 } from 'lucide-react'
import { BAND_CLASS, CARD_CLASS } from '@/app/checkout/[id]/_surfaces'
import { AccountCard, accountBtn } from '@/components/account/AccountSurface'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { feeTerms, payoutTimeLine } from './_withdraw-model'

const usd = (n: number) => `$${n.toFixed(2)}`

export function SummaryCard({
  method,
  amount,
  quote,
  canReview,
  onReview,
}: {
  method: WithdrawalMethod
  amount: number
  quote: WithdrawalQuote | null
  canReview: boolean
  onReview: () => void
}) {
  return (
    <section aria-label="Summary" className={CARD_CLASS}>
      <div className="p-5">
        <h2 className="text-[15px] font-semibold text-text-primary">Summary</h2>
        <dl className="mt-3 space-y-2 text-[13.5px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Amount</dt>
            <dd className="font-semibold tabular-nums text-text-primary">{usd(amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">Fee{quote ? ` (${feeTerms(quote)})` : ''}</dt>
            <dd className="font-semibold tabular-nums text-text-primary">-{usd(quote?.feeAmount ?? 0)}</dd>
          </div>
        </dl>
      </div>

      <div className={cn(BAND_CLASS, 'p-5')}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] font-semibold text-text-primary">You Receive</p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.01em] tabular-nums text-success">{usd(quote?.net ?? 0)}</p>
        </div>
        <button type="button" onClick={onReview} disabled={!canReview} className={cn(accountBtn.primary, 'mt-4 h-11 w-full text-[14px]')}>
          <ArrowLineDownIcon size={18} weight="bold" aria-hidden />
          Withdraw
        </button>
        <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-text-secondary">
          <li className="flex items-start gap-2">
            <ClockIcon size={15} weight="duotone" aria-hidden className="mt-0.5 shrink-0 text-text-tertiary" />
            {payoutTimeLine(method)}
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheckIcon size={15} weight="duotone" aria-hidden className="mt-0.5 shrink-0 text-[#6AA8FF]" />
            Every withdrawal is reviewed before payment.
          </li>
        </ul>
      </div>
    </section>
  )
}

const HOW_IT_WORKS = [
  'Select a payout method.',
  'Enter the amount to withdraw.',
  'We hold the amount and review your withdrawal.',
  'Once paid, the transaction ID appears in your wallet.',
]

export function HowItWorksCard() {
  return (
    <AccountCard>
      <h2 className="text-[15px] font-semibold text-text-primary">How Withdrawals Work</h2>
      <ol className="mt-3 space-y-2.5">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-text-secondary">
            <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-white/[0.06] text-[11px] font-semibold tabular-nums text-text-primary">
              {i + 1}
            </span>
            <span className="sr-only">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
    </AccountCard>
  )
}

export function SubmittingLabel() {
  return (
    <>
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      Processing…
    </>
  )
}
