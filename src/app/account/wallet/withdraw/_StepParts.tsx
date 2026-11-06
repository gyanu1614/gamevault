'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { accountBtn } from '@/components/account/AccountSurface'
import CoinBadge from '@/components/wallet/CoinBadge'
import type { WithdrawalMethod } from '@/lib/actions/withdrawals'
import { shortAddress, type SavedDestination } from './_withdraw-model'

export const usd = (n: number) => `$${n.toFixed(2)}`

/** One label and one value. */
export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[44px] items-center justify-between gap-4 py-2.5', className)}>
      <dt className="min-w-0 text-[14px] text-text-secondary">{label}</dt>
      <dd className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-text-primary">{children}</dd>
    </div>
  )
}

export function ChangeButton({ onClick, label = 'Change' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-sm text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
      {label}
    </button>
  )
}

/** The chosen way of being paid, kept in sight on the steps after it. */
export function ChosenMethod({ method, destination, onChange }: { method: WithdrawalMethod; destination: SavedDestination | null; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-bg-overlay p-3">
      <CoinBadge coin={method.coin} methodName={method.method_name} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text-primary">{method.display_name}</p>
        {destination && (
          <p translate="no" className={cn('truncate text-[13px] text-text-secondary', destination.mono && 'font-mono')}>
            {destination.mono ? shortAddress(destination.value) : destination.value}
          </p>
        )}
      </div>
      <ChangeButton onClick={onChange} />
    </div>
  )
}

/** Back on the left, the way forward filling the rest. */
export function StepActions({ onBack, children, backDisabled }: { onBack?: () => void; children: ReactNode; backDisabled?: boolean }) {
  return (
    <div className="mt-6 flex gap-2">
      {onBack && (
        <button type="button" onClick={onBack} disabled={backDisabled} className={cn(accountBtn.secondary, 'h-11 px-5 text-[14px]')}>
          Back
        </button>
      )}
      {children}
    </div>
  )
}

export const CONTINUE_CLASS = cn(accountBtn.primary, 'h-11 flex-1 text-[14px]')
