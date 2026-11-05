'use client'

/**
 * Step 1: how to be paid. The checkout's payment rows (flat, a trust-blue edge
 * and radio when picked), one row per way of being paid. A coin with several
 * networks opens them underneath, so three USDT rails read as one choice.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { ROW_CHECKED_CLASS, ROW_CLASS, ROW_IDLE_CLASS, rowStyle, TRUST_BLUE } from '@/app/checkout/[id]/_surfaces'
import CoinBadge from '@/components/wallet/CoinBadge'
import type { PayoutDetails } from '@/lib/actions/payout-details'
import type { WithdrawalMethod } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { defaultMethodFor, networkShort, savedDestinationFor, shortAddress, type MethodGroup } from './_withdraw-model'

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
      style={{ boxShadow: `inset 0 0 0 1.5px ${checked ? TRUST_BLUE : 'rgba(255,255,255,0.35)'}` }}
    >
      {checked && <span className="h-2.5 w-2.5 rounded-full" style={{ background: TRUST_BLUE }} />}
    </span>
  )
}

export function MethodPicker({
  groups,
  selected,
  details,
  onSelect,
}: {
  groups: MethodGroup[]
  selected: WithdrawalMethod | null
  details: PayoutDetails | null
  onSelect: (method: WithdrawalMethod) => void
}) {
  return (
    <div role="radiogroup" aria-label="Payout method" className="space-y-2">
      {groups.map((group) => {
        const checked = !!selected && group.methods.some((m) => m.id === selected.id)
        return (
          <div key={group.key}>
            <button
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={group.comingSoon}
              onClick={() => onSelect(defaultMethodFor(group))}
              style={rowStyle(checked)}
              className={cn(
                ROW_CLASS,
                'flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                checked ? ROW_CHECKED_CLASS : ROW_IDLE_CLASS,
                group.comingSoon && 'cursor-not-allowed opacity-50 hover:bg-[#1C1D22]',
              )}
            >
              <CoinBadge coin={group.coin} methodName={group.methodName} muted={group.comingSoon} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-text-primary">{group.label}</span>
                <span className="mt-0.5 block truncate text-[12px]">
                  {group.comingSoon ? (
                    <span className="text-text-tertiary">Coming Soon</span>
                  ) : group.readyDestination ? (
                    <span className="inline-flex max-w-full items-center gap-1 text-success">
                      <CheckCircleIcon size={13} weight="fill" aria-hidden className="shrink-0" />
                      <span className="truncate">{shortAddress(group.readyDestination.value)}</span>
                    </span>
                  ) : (
                    <span className="text-text-tertiary">Not Set Up</span>
                  )}
                </span>
              </span>
              {!group.comingSoon && (
                <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">Min ${group.minWithdrawal}</span>
              )}
              <Radio checked={checked} />
            </button>

            <AnimatePresence initial={false}>
              {checked && group.methods.length > 1 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-1 pb-1 pt-3">
                    <p id={`network-${group.key}`} className="mb-2 text-[12.5px] font-medium text-text-secondary">
                      Network
                    </p>
                    <div role="radiogroup" aria-labelledby={`network-${group.key}`} className="flex flex-wrap gap-2">
                      {group.methods.map((m) => {
                        const on = selected?.id === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onSelect(m)}
                            style={rowStyle(on)}
                            className={cn(
                              'inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-text-primary transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                              on ? ROW_CHECKED_CLASS : ROW_IDLE_CLASS,
                            )}
                          >
                            {networkShort(m.chain)}
                            {savedDestinationFor(m, details) && (
                              <CheckCircleIcon size={14} weight="fill" className="text-success" aria-label="Saved" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
