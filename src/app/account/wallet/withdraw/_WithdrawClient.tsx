'use client'

/**
 * The withdrawal, one step at a time (owner, 2026-11-06: not one long page, and not a
 * narrow card or a pop-up): the steps fill the page on the left, the receipt fills in
 * beside them. Back keeps every answer. The server page hands over everything it needs,
 * so the only requests from here are the live fee sum and the request itself.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { LifebuoyIcon } from '@phosphor-icons/react/dist/csr/Lifebuoy'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { toast } from 'sonner'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, IconTile, accountBtn } from '@/components/account/AccountSurface'
import { IdentityCheckPanel } from '@/components/account/IdentityCheck'
import PayoutDetailsSection from '@/components/account/settings/PayoutDetailsSection'
import { BackButton } from '@/components/marketplace/BackButton'
import Link from '@/components/navigation/AppLink'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { PayoutDetails } from '@/lib/actions/payout-details'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import { createWithdrawalRequest, type WithdrawalMethod, type WithdrawalQuote, type WithdrawalRequest } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import { MethodPicker } from './_MethodPicker'
import { StepAmount } from './_StepAmount'
import { StepBar } from './_StepBar'
import { CONTINUE_CLASS, Row, StepActions, usd } from './_StepParts'
import { StepDone, StepReview } from './_StepReview'
import { StepStage } from './_StepStage'
import { WithdrawFaq } from './_WithdrawHelp'
import { WithdrawRail } from './_WithdrawRail'
import { amountRefusal, chainLabel, gateMessage, groupMethods, isOpenWithdrawal, savedDestinationFor, sendAfterLabel, waitMessage } from './_withdraw-model'

const HEADINGS: Record<number, string> = { 1: 'Payout Method', 2: 'Amount', 3: 'Review', 4: 'Withdrawal Submitted' }

export default function WithdrawClient({
  overview,
  details,
  methods,
  requests,
  pending,
}: {
  overview: WalletOverview | null
  details: PayoutDetails | null
  methods: WithdrawalMethod[] | null
  requests: WithdrawalRequest[]
  pending: number | null
}) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])
  const groups = useMemo(() => groupMethods(methods ?? [], details), [methods, details])

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  // Already set up: that way of being paid is ready, so one click moves on.
  const [selected, setSelected] = useState<WithdrawalMethod | null>(() => groups.find((g) => g.ready)?.ready ?? null)
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addingDetails, setAddingDetails] = useState(false)

  const available = overview ? overview.available + overview.wallet : 0
  const amountNum = parseFloat(amount) || 0
  const destination = savedDestinationFor(selected, details)
  const openRequest = requests.find((r) => isOpenWithdrawal(r.status)) ?? null
  const freezeHours = details?.freezeHours ?? 24
  // UTC on the server and first draw so they match, then the seller's own time zone.
  const [timeZone, setTimeZone] = useState<string | undefined>('UTC')
  useEffect(() => setTimeZone(undefined), [])
  const gate = gateMessage(overview, timeZone)
  const wait = waitMessage(overview, timeZone)

  // Keyboard and screen-reader users land on the new step's heading, once it has
  // replaced the old one (the old step animates out first).
  const moved = useRef(false)
  const focusHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el && moved.current) el.focus({ preventScroll: true })
  }, [])

  const goTo = (next: number) => {
    moved.current = true
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  // The live sum. The page never works out a fee; a newer keystroke cancels the
  // older request, so a slow answer can't overwrite a fresh one.
  const needsQuote = step === 2 || step === 3
  useEffect(() => {
    if (!selected || !needsQuote) return
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
  }, [selected, amountNum, needsQuote])

  const quoteIsCurrent = !!quote && Math.abs(quote.amount - amountNum) < 0.005
  const canReview = amountNum > 0 && quoteIsCurrent && !!quote?.ok && !gate
  const refusal = quoteIsCurrent ? amountRefusal(quote, amountNum) : null

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const result = await createWithdrawalRequest({ amount: amountNum, methodId: selected.id })
      if (!result.success) {
        toast.error(result.error || 'Withdrawal failed. Please try again.')
        return
      }
      goTo(4)
    } catch {
      toast.error('Withdrawal failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AccountPage>
      <div>
        <div className="flex items-center gap-3">
          <BackButton href="/account/wallet" className="bg-white/[0.06] hover:bg-white/[0.1]">
            <ArrowLeftIcon size={18} weight="bold" aria-hidden />
          </BackButton>
          <div className="min-w-0 flex-1">
            <AccountPageHeader
              title="Withdraw Funds"
              actions={
                <Link href="/support" className={accountBtn.secondary}>
                  <LifebuoyIcon size={18} weight="duotone" aria-hidden />
                  Help
                </Link>
              }
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {!overview && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-bg p-4">
              <p className="text-[14px] text-text-secondary">We couldn’t load your balance.</p>
              <button type="button" onClick={refresh} className={accountBtn.secondary}>Try Again</button>
            </div>
          )}
          {step < 4 && gate && overview?.gate.reason === 'kyc_required' && <IdentityCheckPanel message={gate} onVerified={refresh} />}
          {step < 4 && gate && overview?.gate.reason !== 'kyc_required' && (
            <p className="flex items-center gap-3 rounded-lg bg-warning-bg p-4 text-[14px] leading-relaxed text-text-secondary">
              <IconTile tone="attention"><WarningCircleIcon size={22} weight="duotone" /></IconTile>
              {gate}
            </p>
          )}
          {step < 4 && wait && !openRequest && (
            <p className="flex items-center gap-3 rounded-lg bg-[rgba(106,168,255,0.10)] p-4 text-[14px] leading-relaxed text-text-secondary">
              <IconTile tone="trust"><ClockIcon size={22} weight="duotone" /></IconTile>
              {wait}
            </p>
          )}
          {step < 4 && openRequest && (
            <div className="flex flex-col gap-3 rounded-lg bg-[rgba(106,168,255,0.10)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile tone="trust"><HourglassMediumIcon size={22} weight="duotone" /></IconTile>
                <p className="min-w-0 text-[14px] leading-relaxed text-text-secondary">
                  {openRequest.send_after && new Date(openRequest.send_after).getTime() > Date.now()
                    ? `${usd(openRequest.amount)} is scheduled, and we send it after ${sendAfterLabel(openRequest.send_after, timeZone)}.`
                    : `${usd(openRequest.amount)} is being processed.`}{' '}
                  You can withdraw again once it is complete.
                </p>
              </div>
              <Link href="/account/wallet?tab=payouts" className={cn(accountBtn.secondary, 'w-full shrink-0 sm:w-auto')}>View Withdrawal</Link>
            </div>
          )}
        </div>

        <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg bg-bg-raised p-5 sm:p-6">
          {step < 4 && <StepBar step={step} onJump={goTo} />}
          <StepStage stepKey={step} direction={direction}>
            {/* Room for a focus ring, because the stage clips what leaves it. */}
            <div className={cn('px-px pb-px', step < 4 && 'pt-6')}>
              <h2 ref={focusHeading} tabIndex={-1} className={cn('text-[18px] font-semibold text-text-primary focus:outline-none', step === 4 && 'text-center')}>
                {HEADINGS[step]}
              </h2>
              <div className="mt-4">
                {step === 1 && (
                  <>
                    <dl className="mb-4 divide-y divide-white/[0.07] border-y border-white/[0.07] lg:hidden">
                      <Row label="Available Balance">{usd(Math.max(0, available))}</Row>
                      {(overview?.pending ?? 0) > 0 && <Row label="Pending"><span className="text-text-secondary">{usd(overview?.pending ?? 0)}</span></Row>}
                    </dl>
                    {methods === null ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-bg-overlay p-4">
                        <p className="text-[14px] text-text-secondary">We couldn’t load the payout methods.</p>
                        <button type="button" onClick={refresh} className={accountBtn.secondary}>Try Again</button>
                      </div>
                    ) : (
                      <MethodPicker groups={groups} selected={selected} details={details} onSelect={setSelected} />
                    )}
                    {selected && !destination && (
                      <div className="mt-3 flex flex-col gap-3 rounded-md bg-bg-overlay p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[14px] leading-relaxed text-text-secondary">
                          Add {selected.method_type === 'crypto' ? `a ${(selected.coin ?? '').toUpperCase()} address on ${chainLabel(selected.chain)}` : 'a Payoneer email'} to use this method. We send withdrawals to it {freezeHours} hours after you save it.
                        </p>
                        <button type="button" onClick={() => setAddingDetails(true)} className={cn(accountBtn.primary, 'w-full shrink-0 sm:w-auto')}>
                          Add Payout Details
                        </button>
                      </div>
                    )}
                    <StepActions>
                      <button type="button" disabled={!selected || !destination} onClick={() => goTo(2)} className={CONTINUE_CLASS}>
                        Continue
                      </button>
                    </StepActions>
                  </>
                )}
                {step === 2 && selected && (
                  <StepAmount
                    method={selected}
                    destination={destination}
                    available={available}
                    amount={amount}
                    quote={quote}
                    refusal={refusal}
                    canContinue={canReview}
                    onAmount={setAmount}
                    onBack={() => goTo(1)}
                    onContinue={() => goTo(3)}
                  />
                )}
                {step === 3 && selected && (
                  <StepReview
                    method={selected}
                    destination={destination}
                    amount={amountNum}
                    quote={quote}
                    sendAfter={quote?.sendAfter ? sendAfterLabel(quote.sendAfter, timeZone) : null}
                    submitting={submitting}
                    onChangeMethod={() => goTo(1)}
                    onChangeAmount={() => goTo(2)}
                    onSubmit={submit}
                  />
                )}
                {step === 4 && selected && <StepDone method={selected} net={quote?.net ?? 0} sendAfter={quote?.sendAfter ? sendAfterLabel(quote.sendAfter, timeZone) : null} onDone={() => router.push('/account/wallet?tab=payouts')} />}
              </div>
            </div>
          </StepStage>
        </section>
        <WithdrawRail overview={overview} pending={pending} available={available} method={selected} amount={amountNum} quote={quote} step={step} />
        </div>

        {step < 4 && (
          <div className="mt-8">
            <WithdrawFaq freezeHours={freezeHours} />
          </div>
        )}
      </div>

      <Dialog
        open={addingDetails}
        onOpenChange={(open) => {
          setAddingDetails(open)
          // Saved details come back from the server, and the step moves on from there.
          if (!open) refresh()
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-[560px] gap-0 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="mb-4 pr-8 text-[18px] font-semibold">Payout Details</DialogTitle>
          {selected && (
            <PayoutDetailsSection
              only={selected.method_type === 'crypto' ? { kind: 'crypto', coin: selected.coin ?? 'usdt', chain: selected.chain ?? 'tron' } : { kind: 'payoneer' }}
              onSaved={() => {
                setAddingDetails(false)
                refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AccountPage>
  )
}
