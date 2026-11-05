'use client'

/**
 * The withdrawal form. The server page hands it everything it needs, so the only
 * requests from here are the live fee sum and the request itself. Three numbered
 * steps on one surface, the sum beside them, and help on the page where the
 * questions come up.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { LifebuoyIcon } from '@phosphor-icons/react/dist/csr/Lifebuoy'
import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey'
import { ReceiptIcon } from '@phosphor-icons/react/dist/csr/Receipt'
import { ScalesIcon } from '@phosphor-icons/react/dist/csr/Scales'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { toast } from 'sonner'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, ICON_TILE, IconTile, accountBtn } from '@/components/account/AccountSurface'
import { BalanceHero, usd, type BalanceRow } from '@/components/account/BalanceHero'
import { IdentityCheckPanel } from '@/components/account/IdentityCheck'
import Link from '@/components/navigation/AppLink'
import CoinBadge from '@/components/wallet/CoinBadge'
import WithdrawalRequestCard from '@/components/wallet/WithdrawalRequestCard'
import type { PayoutDetails } from '@/lib/actions/payout-details'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import { createWithdrawalRequest, type WithdrawalMethod, type WithdrawalQuote, type WithdrawalRequest } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from './_ConfirmDialog'
import { MethodPicker } from './_MethodPicker'
import { HowItWorksCard, SummaryCard } from './_SummaryRail'
import { HelpCard, WithdrawFaq } from './_WithdrawHelp'
import {
  amountRefusal,
  chainLabel,
  gateMessage,
  groupMethods,
  isOpenWithdrawal,
  maxWithdrawable,
  savedDestinationFor,
} from './_withdraw-model'

const SETTINGS_PAYOUTS = '/account/settings?tab=payouts'

function StepHead({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-md text-[13px] font-bold tabular-nums',
          done ? ICON_TILE.money : 'bg-white/[0.07] text-text-primary',
        )}
      >
        {done ? <CheckIcon size={15} weight="bold" /> : n}
      </span>
      <h2 id={`withdraw-step-${n}`} className="text-[16px] font-semibold text-text-primary">{title}</h2>
    </div>
  )
}

/** Digits and one point, two decimals at most. */
function cleanAmount(raw: string): string {
  const [whole, ...rest] = raw.replace(/[^\d.]/g, '').split('.')
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole
}

export default function WithdrawClient({
  overview,
  details,
  methods,
  requests,
}: {
  overview: WalletOverview | null
  details: PayoutDetails | null
  methods: WithdrawalMethod[] | null
  requests: WithdrawalRequest[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<WithdrawalMethod | null>(null)
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const refresh = useCallback(() => router.refresh(), [router])
  const groups = useMemo(() => groupMethods(methods ?? [], details), [methods, details])
  const available = overview ? Math.max(0, overview.available + overview.wallet) : 0
  const amountNum = parseFloat(amount) || 0
  // UTC on the server and first draw so they match, then the seller's own time zone.
  const [gate, setGate] = useState(() => gateMessage(overview, 'UTC'))
  useEffect(() => setGate(gateMessage(overview)), [overview])
  const destination = savedDestinationFor(selected, details)
  const openRequest = requests.find((r) => isOpenWithdrawal(r.status)) ?? null
  const freezeHours = details?.freezeHours ?? 24

  // The live sum. The page never works out a fee; a newer keystroke cancels the
  // older request, so a slow answer can't overwrite a fresh one.
  useEffect(() => {
    if (!selected) {
      setQuote(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ method: selected.id, amount: String(amountNum) })
        const res = await fetch(`/api/account/withdrawal-quote?${params}`, { signal: controller.signal, cache: 'no-store' })
        const body = await res.json()
        setQuote(res.ok ? body.quote : null)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setQuote(null)
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [selected, amountNum])

  const quoteIsCurrent = !!quote && Math.abs(quote.amount - amountNum) < 0.005
  const canReview = amountNum > 0 && !submitting && quoteIsCurrent && !!quote?.ok && !gate
  const refusal = quoteIsCurrent ? amountRefusal(quote, amountNum) : null

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const result = await createWithdrawalRequest({ amount: amountNum, methodId: selected.id })
      if (!result.success) {
        setShowConfirm(false)
        toast.error(result.error || 'Withdrawal failed. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setShowConfirm(false)
      toast.error('Withdrawal failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const rows: BalanceRow[] = [
    { label: 'Pending', value: usd(overview?.pending ?? 0), tone: 'trust', icon: <HourglassMediumIcon size={18} weight="duotone" /> },
    { label: 'Processing', value: usd(overview?.locked ?? 0), tone: 'speed', icon: <LockKeyIcon size={18} weight="duotone" /> },
    { label: 'On Hold', value: usd(overview?.frozen ?? 0), tone: 'attention', icon: <ScalesIcon size={18} weight="duotone" /> },
    { label: 'Store Credit', value: usd(overview?.wallet ?? 0), tone: 'money', icon: <ReceiptIcon size={18} weight="duotone" /> },
  ]

  return (
    <AccountPage>
      <Link href="/account/wallet" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary">
        <ArrowLeftIcon size={15} weight="bold" aria-hidden />
        Back To Wallet
      </Link>
      <AccountPageHeader
        title="Withdraw Funds"
        actions={
          <Link href="/support" className={accountBtn.secondary}>
            <LifebuoyIcon size={18} weight="duotone" aria-hidden />
            Help
          </Link>
        }
      />

      <div className="mt-5 space-y-4">
        {overview ? (
          <BalanceHero
            label="Available Balance"
            amount={available}
            caption={available > 0 ? undefined : 'Funds from completed sales appear here.'}
            rows={rows}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-bg p-4">
            <p className="text-[13px] text-text-secondary">We couldn’t load your balance.</p>
            <button type="button" onClick={refresh} className={accountBtn.secondary}>Try Again</button>
          </div>
        )}

        {gate && overview?.gate.reason === 'kyc_required' ? (
          <IdentityCheckPanel message={gate} onVerified={refresh} />
        ) : gate ? (
          <p className="flex items-center gap-3 rounded-lg bg-warning-bg p-4 text-[13px] leading-relaxed text-text-secondary">
            <IconTile tone="attention"><WarningCircleIcon size={22} weight="duotone" /></IconTile>
            {gate}
          </p>
        ) : null}

        {openRequest && (
          <div className="flex flex-col gap-3 rounded-lg bg-[rgba(106,168,255,0.10)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <IconTile tone="trust"><HourglassMediumIcon size={22} weight="duotone" /></IconTile>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary">Withdrawal In Progress</p>
                <p className="mt-0.5 text-[12.5px] text-text-secondary">{usd(openRequest.amount)} is being processed. You can withdraw again once it is complete.</p>
              </div>
            </div>
            <Link href="/account/wallet?tab=payouts" className={cn(accountBtn.secondary, 'w-full shrink-0 sm:w-auto')}>
              View Withdrawal
            </Link>
          </div>
        )}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
            <section aria-labelledby="withdraw-step-1" className="p-5 sm:p-6">
              <StepHead n={1} title="Payout Method" done={!!selected} />
              <div className="mt-4">
                {methods === null ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-bg-overlay p-4">
                    <p className="text-[13px] text-text-secondary">We couldn’t load the payout methods.</p>
                    <button type="button" onClick={refresh} className={accountBtn.secondary}>Try Again</button>
                  </div>
                ) : (
                  <MethodPicker groups={groups} selected={selected} details={details} onSelect={setSelected} />
                )}
              </div>
            </section>

            <section aria-labelledby="withdraw-step-2" className="p-5 sm:p-6">
              <StepHead n={2} title="Amount" done={quoteIsCurrent && !!quote?.ok && amountNum > 0} />
              {selected ? (
                <div className="mt-4">
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] font-bold text-text-tertiary">$</span>
                    <input
                      aria-labelledby="withdraw-step-2"
                      name="amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(cleanAmount(e.target.value))}
                      className="h-14 w-full rounded-md border border-transparent bg-bg-overlay pl-9 pr-4 text-[22px] font-bold tabular-nums text-text-primary placeholder:text-text-disabled focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft"
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      {[
                        { label: '25%', share: 0.25 },
                        { label: '50%', share: 0.5 },
                        { label: 'Max', share: 1 },
                      ].map(({ label, share }) => (
                        <button
                          key={label}
                          type="button"
                          disabled={available <= 0}
                          onClick={() => setAmount((Math.floor(maxWithdrawable(selected, available) * share * 100) / 100).toFixed(2))}
                          className="inline-flex h-8 items-center rounded-md bg-white/[0.06] px-3 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[12.5px] tabular-nums text-text-tertiary">Min {usd(selected.min_withdrawal)}</p>
                  </div>
                  {refusal && (
                    <p role="alert" className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-warning">
                      <WarningCircleIcon size={16} weight="duotone" aria-hidden className="mt-px shrink-0" />
                      {refusal}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 pl-10 text-[13px] text-text-tertiary">Select a payout method to continue.</p>
              )}
            </section>

            <section aria-labelledby="withdraw-step-3" className="p-5 sm:p-6">
              <StepHead n={3} title="Payout Details" done={!!destination} />
              {!selected ? (
                <p className="mt-2 pl-10 text-[13px] text-text-tertiary">Your saved details appear here.</p>
              ) : destination ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3 rounded-md bg-bg-overlay p-3.5">
                    <CoinBadge coin={selected.coin} methodName={selected.method_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-text-tertiary">{destination.label}</p>
                      <p translate="no" className={cn('break-all text-[13px] text-text-primary', destination.mono && 'font-mono')}>{destination.value}</p>
                    </div>
                    <Link href={SETTINGS_PAYOUTS} className="shrink-0 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary">
                      Change
                    </Link>
                  </div>
                  <p className="mt-2 text-[12.5px] text-text-tertiary">Changing these details pauses withdrawals for {freezeHours} hours.</p>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3 rounded-md bg-bg-overlay p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    Add a{' '}
                    {selected.method_type === 'crypto'
                      ? `${(selected.coin ?? '').toUpperCase()} address on ${chainLabel(selected.chain)}`
                      : 'Payoneer email'}{' '}
                    to use this method. Withdrawals open {freezeHours} hours after saving.
                  </p>
                  <Link href={SETTINGS_PAYOUTS} className={cn(accountBtn.primary, 'w-full shrink-0 sm:w-auto')}>
                    Add Payout Details
                  </Link>
                </div>
              )}
            </section>
          </div>

          {requests.length > 0 && (
            <section aria-labelledby="withdraw-recent">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="withdraw-recent" className="text-[15px] font-semibold text-text-primary">Recent Withdrawals</h2>
                <Link href="/account/wallet?tab=payouts" className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary">
                  View All
                  <ArrowRightIcon size={14} weight="bold" aria-hidden />
                </Link>
              </div>
              <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
                {requests.slice(0, 3).map((request) => (
                  <WithdrawalRequestCard key={request.id} request={request} onUpdate={refresh} />
                ))}
              </div>
            </section>
          )}

          <WithdrawFaq freezeHours={freezeHours} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          {selected ? (
            <SummaryCard method={selected} amount={amountNum} quote={quote} canReview={canReview} onReview={() => setShowConfirm(true)} />
          ) : (
            <HowItWorksCard />
          )}
          <HelpCard />
        </aside>
      </div>

      {selected && (
        <ConfirmDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          method={selected}
          destination={destination}
          amount={amountNum}
          quote={quote}
          submitting={submitting}
          submitted={submitted}
          onSubmit={submit}
          onDone={() => router.push('/account/wallet?tab=payouts')}
        />
      )}
    </AccountPage>
  )
}
