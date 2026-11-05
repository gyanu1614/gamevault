'use client'

/**
 * The last step before an irreversible transfer, laid out as a receipt, then a real
 * finish instead of a toast and a jump. The FULL address shows in 4-character groups:
 * address poisoning works because people check only the first and last few
 * characters, so truncating here would defeat the point of confirming at all.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { BAND_CLASS } from '@/app/checkout/[id]/_surfaces'
import { accountBtn } from '@/components/account/AccountSurface'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import CoinBadge from '@/components/wallet/CoinBadge'
import { chunkAddress } from '@/lib/crypto/address-validation'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { SubmittingLabel } from './_SummaryRail'
import { chainLabel, payoutTimeLine, type SavedDestination } from './_withdraw-model'

const usd = (n: number) => `$${n.toFixed(2)}`

export function ConfirmDialog({
  open,
  onOpenChange,
  method,
  destination,
  amount,
  quote,
  submitting,
  submitted,
  onSubmit,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: WithdrawalMethod
  destination: SavedDestination | null
  amount: number
  quote: WithdrawalQuote | null
  submitting: boolean
  submitted: boolean
  onSubmit: () => void
  onDone: () => void
}) {
  const reduceMotion = useReducedMotion()
  const isCrypto = method.method_type === 'crypto'
  const net = quote?.net ?? 0

  const handleOpenChange = (next: boolean) => {
    if (submitting) return
    // Closing the finished dialog goes to the withdrawal, as its button does.
    if (submitted && !next) return onDone()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0">
        {submitted ? (
          <div className="p-6 text-center">
            <motion.span
              aria-hidden
              initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-bg text-success"
            >
              <CheckIcon size={28} weight="bold" />
            </motion.span>
            <DialogTitle className="mt-4 text-center text-[18px] font-semibold">Withdrawal Submitted</DialogTitle>
            <DialogDescription className="mt-1.5 text-center">{payoutTimeLine(method)} We’ll email you once it’s processed.</DialogDescription>
            <dl className="mt-5 space-y-2 rounded-md bg-bg-overlay p-3.5 text-left text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Method</dt>
                <dd className="font-semibold text-text-primary">{method.display_name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">You Receive</dt>
                <dd className="font-bold tabular-nums text-success">{usd(net)}</dd>
              </div>
            </dl>
            <button type="button" onClick={onDone} className={cn(accountBtn.primary, 'mt-5 h-11 w-full text-[14px]')}>
              View Withdrawal
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 sm:p-6">
              <DialogTitle className="pr-8 text-base font-semibold">Confirm Withdrawal</DialogTitle>
              <DialogDescription className="mt-1">
                {isCrypto ? 'Crypto transfers can’t be reversed. Check the address carefully.' : 'Check that this is your Payoneer account.'}
              </DialogDescription>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] text-text-secondary">You Receive</p>
                  <p className="mt-0.5 text-[34px] font-bold leading-none tracking-[-0.01em] tabular-nums text-success">{usd(net)}</p>
                </div>
                <CoinBadge coin={method.coin} methodName={method.method_name} size={44} />
              </div>

              <dl className="mt-5 space-y-2 border-t border-white/[0.07] pt-4 text-[13.5px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-secondary">Amount</dt>
                  <dd className="font-semibold tabular-nums text-text-primary">{usd(amount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-secondary">Fee</dt>
                  <dd className="font-semibold tabular-nums text-text-primary">-{usd(quote?.feeAmount ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-secondary">Method</dt>
                  <dd className="font-semibold text-text-primary">{method.display_name}</dd>
                </div>
              </dl>
            </div>

            <div className={cn(BAND_CLASS, 'p-5 sm:p-6')}>
              <p className="text-[13px] text-text-secondary">{isCrypto ? 'Wallet Address' : 'Payoneer Account'}</p>
              <div className="mt-1.5 rounded-md bg-black/20 px-3.5 py-3">
                {isCrypto ? (
                  <p translate="no" className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[13px] leading-relaxed text-text-primary">
                    {chunkAddress(destination?.value ?? '').map((group, i) => (
                      <span key={i}>{group}</span>
                    ))}
                  </p>
                ) : (
                  <p className="break-all text-[13px] text-text-primary">{destination?.value}</p>
                )}
              </div>
              {isCrypto && (
                <p className="mt-2.5 flex items-center gap-2 text-[12.5px] font-medium text-warning">
                  <WarningCircleIcon size={16} weight="duotone" aria-hidden className="shrink-0" />
                  Network: {chainLabel(method.chain)}
                </p>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => onOpenChange(false)} disabled={submitting} className={cn(accountBtn.secondary, 'h-11 sm:px-6')}>
                  Back
                </button>
                <button type="button" onClick={onSubmit} disabled={submitting} className={cn(accountBtn.primary, 'h-11 flex-1 text-[14px]')}>
                  {submitting ? <SubmittingLabel /> : `Withdraw ${usd(amount)}`}
                </button>
              </div>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-text-tertiary">
                If declined, the amount returns to your balance.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
