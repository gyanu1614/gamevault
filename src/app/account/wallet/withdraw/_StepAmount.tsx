'use client'

import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'
import { CONTINUE_CLASS, ChosenMethod, Row, StepActions, usd } from './_StepParts'
import { cleanAmount, feeTerms, maxAmount, type SavedDestination } from './_withdraw-model'

export function StepAmount({
  method,
  destination,
  available,
  amount,
  quote,
  refusal,
  canContinue,
  onAmount,
  onBack,
  onContinue,
}: {
  method: WithdrawalMethod
  destination: SavedDestination | null
  available: number
  amount: string
  quote: WithdrawalQuote | null
  refusal: string | null
  canContinue: boolean
  onAmount: (amount: string) => void
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canContinue) onContinue()
      }}
    >
      <ChosenMethod method={method} destination={destination} onChange={onBack} />

      <label htmlFor="withdraw-amount" className="sr-only">
        Amount
      </label>
      <div className="relative mt-3">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[30px] font-bold text-text-tertiary">$</span>
        <input
          id="withdraw-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => onAmount(cleanAmount(e.target.value))}
          className="h-16 w-full rounded-md border border-transparent bg-bg-overlay pl-10 pr-20 text-[30px] font-bold tabular-nums text-text-primary placeholder:text-text-disabled focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft"
        />
        <button
          type="button"
          disabled={available <= 0}
          onClick={() => onAmount(maxAmount(method, available))}
          className="absolute right-3 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-md bg-white/[0.08] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Max
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[13px] tabular-nums text-text-tertiary">
        <span>Available {usd(Math.max(0, available))}</span>
        <span>Min {usd(method.min_withdrawal)}</span>
      </div>

      {refusal && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-warning">
          <WarningCircleIcon size={16} weight="duotone" aria-hidden className="mt-0.5 shrink-0" />
          {refusal}
        </p>
      )}

      {/* Beside the steps on a wide screen, in the receipt. */}
      <dl className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07] lg:hidden">
        {/* Nothing typed, nothing charged: the quote's minimum fee would read as a fee on nothing. */}
        <Row label={`Fee${quote ? ` (${feeTerms(quote)})` : ''}`}>-{usd(parseFloat(amount) > 0 ? quote?.feeAmount ?? 0 : 0)}</Row>
        <Row label="You Receive">
          <span className="text-[16px] font-bold text-success">{usd(quote?.net ?? 0)}</span>
        </Row>
      </dl>

      <StepActions onBack={onBack}>
        <button type="submit" disabled={!canContinue} className={CONTINUE_CLASS}>
          Continue
        </button>
      </StepActions>
    </form>
  )
}
