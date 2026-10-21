import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { BankIcon } from '@phosphor-icons/react/dist/ssr/Bank'
import { CalendarCheckIcon } from '@phosphor-icons/react/dist/ssr/CalendarCheck'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle'
import { CurrencyBtcIcon } from '@phosphor-icons/react/dist/ssr/CurrencyBtc'
import { CurrencyCircleDollarIcon } from '@phosphor-icons/react/dist/ssr/CurrencyCircleDollar'
import { CurrencyEthIcon } from '@phosphor-icons/react/dist/ssr/CurrencyEth'
import { LockKeyIcon } from '@phosphor-icons/react/dist/ssr/LockKey'
import { ScalesIcon } from '@phosphor-icons/react/dist/ssr/Scales'
import { TimerIcon } from '@phosphor-icons/react/dist/ssr/Timer'
import Link from '@/components/navigation/AppLink'
import { IconTile, InfoTable } from '@/components/info'
import { describeWithdrawalFee, type PublicWithdrawalMethod, type PublicWithdrawalTerms } from '@/lib/fees/public-rates'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { hoursText } from './_fees-content'

/** Each payout rail's own mark: bank for fiat, the coin for crypto. */
function railIcon(m: PublicWithdrawalMethod): ComponentType<IconProps> {
  if (m.type !== 'crypto') return BankIcon
  if (/bitcoin|btc/i.test(m.displayName)) return CurrencyBtcIcon
  if (/ethereum|eth\b/i.test(m.displayName)) return CurrencyEthIcon
  return CurrencyCircleDollarIcon
}

/** Payout methods beside "when a sale can be withdrawn", both from the payout tables. */
export function GettingPaid({ w }: { w: PublicWithdrawalTerms }) {
  const when: { icon: ComponentType<IconProps>; title: string; value: string }[] = [
    { icon: CheckCircleIcon, title: 'Buyer confirms', value: `Withdrawable ${hoursText(w.completionHoldHours)} later` },
    { icon: TimerIcon, title: "Buyer doesn't confirm", value: 'Withdrawable when the protection window closes' },
    { icon: ScalesIcon, title: 'Dispute opened', value: `Amount set aside until it's decided (open for ${w.disputeWindowDays} days)` },
    { icon: CalendarCheckIcon, title: 'First withdrawal', value: `${w.minAccountAgeDays} days after your seller account is approved` },
    { icon: LockKeyIcon, title: 'Payout details changed', value: `Withdrawals pause for ${hoursText(w.payoutFreezeHours)}` },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <InfoTable
        className="min-w-0 lg:col-span-7"
        caption="Payout methods"
        columns={[
          { key: 'method', label: 'Payout Method' },
          { key: 'fee', label: 'Fee' },
          { key: 'min', label: 'Minimum', align: 'right' },
        ]}
        rows={w.methods.map((m) => ({
          key: m.name,
          cells: [
            <span key="m" className="flex items-center gap-3 font-medium">
              <IconTile icon={railIcon(m)} tone="blue" size="sm" />
              {m.displayName}
            </span>,
            <span key="f" className="tabular-nums text-text-secondary">
              {describeWithdrawalFee(m)}
            </span>,
            <span key="n" className="font-semibold tabular-nums">{`$${m.minWithdrawal.toFixed(0)}`}</span>,
          ],
        }))}
      />
      <aside aria-labelledby="withdraw-when" className={cn('min-w-0 rounded-lg p-5 sm:p-6 lg:col-span-5', MARKET_CARD)}>
        <h3 id="withdraw-when" className="text-body-lg font-semibold text-text-primary">
          When You Can Withdraw
        </h3>
        <ul className="mt-4 space-y-4">
          {when.map((r) => (
            <li key={r.title} className="flex items-start gap-3">
              <IconTile icon={r.icon} tone="blue" size="sm" />
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-text-primary">{r.title}</span>
                <span className="block text-body-sm text-text-secondary">{r.value}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-white/[0.07] pt-4 text-caption text-text-tertiary">
          Protection windows by category are on the{' '}
          <Link href="/safedrop#windows" className="font-semibold text-text-secondary underline decoration-white/25 underline-offset-4 hover:text-text-primary">
            SafeDrop page
          </Link>
          .
        </p>
      </aside>
    </div>
  )
}
