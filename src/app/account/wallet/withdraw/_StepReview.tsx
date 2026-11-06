'use client'

/**
 * The last look before an irreversible transfer. The FULL address shows in 4-character
 * groups: address poisoning works because people check only the first and last few
 * characters, so truncating here would defeat the point of checking at all.
 */

import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { motion, useReducedMotion } from 'framer-motion'
import { accountBtn } from '@/components/account/AccountSurface'
import { BuyButton } from '@/components/marketplace/BuyButton'
import { chunkAddress } from '@/lib/crypto/address-validation'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { ChangeButton, Row, StepActions, usd } from './_StepParts'
import { chainLabel, payoutTimeLine, type SavedDestination } from './_withdraw-model'

export function StepReview({
  method,
  destination,
  amount,
  quote,
  sendAfter,
  submitting,
  onChangeMethod,
  onChangeAmount,
  onSubmit,
}: {
  method: WithdrawalMethod
  destination: SavedDestination | null
  amount: number
  quote: WithdrawalQuote | null
  /** The wait after a payout change: when this goes out. */
  sendAfter: string | null
  submitting: boolean
  onChangeMethod: () => void
  onChangeAmount: () => void
  onSubmit: () => void
}) {
  const isCrypto = method.method_type === 'crypto'
  return (
    <div>
      <dl className="divide-y divide-white/[0.07]">
        <Row label="Amount">
          <span className="inline-flex items-center gap-3">
            {usd(amount)}
            <ChangeButton onClick={onChangeAmount} />
          </span>
        </Row>
        <Row label="Fee">-{usd(quote?.feeAmount ?? 0)}</Row>
        <Row label="You Receive">
          <span className="text-[20px] font-bold text-success">{usd(quote?.net ?? 0)}</span>
        </Row>
        <Row label="Payout Method">
          <span className="inline-flex items-center gap-3">
            {method.display_name}
            <ChangeButton onClick={onChangeMethod} />
          </span>
        </Row>
        {sendAfter && <Row label="We Send It After">{sendAfter}</Row>}
      </dl>

      <div className="mt-3 rounded-md bg-bg-overlay p-3.5">
        <p className="text-[13px] text-text-secondary">{isCrypto ? `Wallet Address · ${chainLabel(method.chain)}` : 'Payoneer Account'}</p>
        {isCrypto ? (
          <p translate="no" className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[14px] leading-relaxed text-text-primary">
            {chunkAddress(destination?.value ?? '').map((group, i) => (
              <span key={i}>{group}</span>
            ))}
          </p>
        ) : (
          <p className="mt-1.5 break-all text-[14px] text-text-primary">{destination?.value}</p>
        )}
      </div>

      {isCrypto && (
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-warning">
          <WarningCircleIcon size={16} weight="duotone" aria-hidden className="mt-0.5 shrink-0" />
          Crypto transfers can’t be reversed. Check the address carefully.
        </p>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-text-tertiary">
        {sendAfter ? 'You can cancel it until then.' : payoutTimeLine(method)} If declined, the amount returns to your balance.
      </p>

      <StepActions onBack={onChangeAmount} backDisabled={submitting}>
        <BuyButton size="md" className="flex-1" onClick={onSubmit} disabled={submitting} loading={submitting} loadingLabel="Processing…">
          Withdraw {usd(amount)}
        </BuyButton>
      </StepActions>
    </div>
  )
}

export function StepDone({ method, net, sendAfter, onDone }: { method: WithdrawalMethod; net: number; sendAfter: string | null; onDone: () => void }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="text-center">
      <motion.span
        aria-hidden
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-bg text-success"
      >
        <CheckIcon size={28} weight="bold" />
      </motion.span>
      <p className="mt-4 text-[14px] leading-relaxed text-text-secondary">{sendAfter ? `We send it after ${sendAfter}. You can cancel it until then.` : payoutTimeLine(method)} We’ll email you once it’s processed.</p>
      <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07] text-left">
        <Row label="Payout Method">{method.display_name}</Row>
        <Row label="You Receive">
          <span className="text-[16px] font-bold text-success">{usd(net)}</span>
        </Row>
      </dl>
      <button type="button" onClick={onDone} className={cn(accountBtn.primary, 'mt-6 h-11 w-full text-[14px]')}>
        View Withdrawal
      </button>
    </div>
  )
}
