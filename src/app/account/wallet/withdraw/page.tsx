'use client'

import { CHAIN_LABELS, chunkAddress } from '@/lib/crypto/address-validation'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
  Bitcoin,
  DollarSign,
  ArrowDownToLine,
  Clock,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import CoinBadge from '@/components/wallet/CoinBadge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
// PR 7: every balance figure and every fee number on this page comes from two
// SQL functions — wallet_available_balance (available / pending / frozen /
// locked + the seller gate) and withdrawal_quote (fee %, flat, minimum fee,
// net, first refusal). The destination is the seller's SAVED payout details.
import { getMyWalletOverview, type WalletOverview } from '@/lib/actions/wallet-ledger'
import { getMyPayoutDetails, type PayoutDetails } from '@/lib/actions/payout-details'
import {
  getWithdrawalMethods,
  quoteWithdrawal,
  createWithdrawalRequest,
  type WithdrawalMethod,
  type WithdrawalQuote,
} from '@/lib/actions/withdrawals'

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
const trimNum = (n: number) => Number(n).toFixed(2).replace(/\.?0+$/, '')
/** "3% + $5" / "3% (min $5)" — the quote's terms as words. */
function feeTerms(q: WithdrawalQuote): string {
  const parts = [q.feePct > 0 ? `${trimNum(q.feePct)}%` : '', q.feeFixed > 0 ? `$${trimNum(q.feeFixed)}` : ''].filter(Boolean)
  const base = parts.join(' + ') || 'no fee'
  return q.feeMin > 0 ? `${base}, min $${trimNum(q.feeMin)}` : base
}

// Payment method icons mapping
export default function WithdrawPage() {
  const router = useRouter()
  const { user } = useAuth()
  // null = still loading; number = matured seller balance + store credit.
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [overview, setOverview] = useState<WalletOverview | null>(null)
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails | null>(null)
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null)

  const [methods, setMethods] = useState<WithdrawalMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null)
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState<number>(0)
  const [netAmount, setNetAmount] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoadingMethods, setIsLoadingMethods] = useState(true)

  useEffect(() => {
    loadMethods()
  }, [])

  // Load the balance breakdown + saved payout details (one RPC each).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [bal, details] = await Promise.all([getMyWalletOverview(), getMyPayoutDetails()])
      if (cancelled) return
      if (bal.success && bal.overview) {
        setOverview(bal.overview)
        setAvailableBalance(Math.max(0, bal.overview.available + bal.overview.wallet))
      } else {
        setAvailableBalance(0)
      }
      if (details.success && details.details) setPayoutDetails(details.details)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Live quote from the RPC when the amount or method changes. The page never
  // computes a fee; it renders exactly what withdrawal_quote returns.
  useEffect(() => {
    const run = async () => {
      if (selectedMethod) {
        const amt = parseFloat(amount)
        const result = await quoteWithdrawal(selectedMethod.id, Number.isFinite(amt) && amt > 0 ? amt : 0)
        if (result.success && result.quote) {
          setQuote(result.quote)
          setFee(result.quote.feeAmount)
          setNetAmount(result.quote.net)
          return
        }
      }
      setQuote(null)
      setFee(0)
      setNetAmount(0)
    }
    const debounce = setTimeout(run, 250)
    return () => clearTimeout(debounce)
  }, [amount, selectedMethod])

  async function loadMethods() {
    setIsLoadingMethods(true)
    const result = await getWithdrawalMethods()
    if (result.success && result.methods) {
      setMethods(result.methods)
    } else {
      toast.error('Failed to load withdrawal methods')
    }
    setIsLoadingMethods(false)
  }

  const handleMethodSelect = (method: WithdrawalMethod) => {
    setSelectedMethod(method)
    setAmount('')
  }

  const handleSubmit = async () => {
    if (!selectedMethod) return

    const amountNum = parseFloat(amount)

    // Validate amount
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (amountNum < selectedMethod.min_withdrawal) {
      toast.error(`Minimum withdrawal is $${selectedMethod.min_withdrawal}`)
      return
    }

    if (selectedMethod.max_withdrawal && amountNum > selectedMethod.max_withdrawal) {
      toast.error(`Maximum withdrawal is $${selectedMethod.max_withdrawal}`)
      return
    }

    if (amountNum > (availableBalance ?? 0)) {
      toast.error('Insufficient balance')
      return
    }

    // The quote is the gate (account age, payout-details freeze, negative
    // balance, open withdrawal, saved destination, minimum, available).
    if (!quote?.ok) {
      toast.error(quote?.message || 'This withdrawal cannot be requested right now.')
      return
    }

    // Everything validated — show the review step. Crypto sends are final,
    // so the last thing between a seller and an irreversible transfer should
    // be the FULL address, not a truncated one they have already stopped
    // reading.
    setShowConfirm(true)
  }

  const submitRequest = async () => {
    if (!selectedMethod) return
    const amountNum = parseFloat(amount)

    setIsSubmitting(true)
    try {
      // Destination = the saved payout details; the RPC re-runs the quote
      // inside its transaction and snapshots every fee field on the row.
      const result = await createWithdrawalRequest({
        amount: amountNum,
        methodId: selectedMethod.id,
      })

      if (result.success) {
        toast.success('Withdrawal request submitted! Admin will review it shortly.')
        router.push('/account/wallet')
      } else {
        setShowConfirm(false)
        toast.error(result.error || 'Failed to create withdrawal request')
      }
    } catch {
      setShowConfirm(false)
      toast.error('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** The saved destination for the selected method, or null when none is saved. */
  const savedDestination = (() => {
    if (!selectedMethod || !payoutDetails) return null
    if (selectedMethod.method_type === 'crypto') {
      const ok =
        !!payoutDetails.cryptoAddress &&
        payoutDetails.cryptoChain === (selectedMethod.chain ?? '') &&
        payoutDetails.cryptoCoin === (selectedMethod.coin ?? '')
      return ok ? { label: `${(payoutDetails.cryptoCoin ?? '').toUpperCase()} · ${CHAIN_LABELS[payoutDetails.cryptoChain as keyof typeof CHAIN_LABELS] ?? payoutDetails.cryptoChain}`, value: payoutDetails.cryptoAddress!, mono: true } : null
    }
    if (selectedMethod.method_name === 'payoneer') {
      return payoutDetails.payoneerEmail ? { label: 'Payoneer account', value: payoutDetails.payoneerEmail, mono: false } : null
    }
    return null
  })()

  if (availableBalance === null) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
      </div>
    )
  }

  const amountNum = parseFloat(amount) || 0
  const gate = overview?.gate
  const gateMessage = gate && !gate.eligible
    ? gate.reason === 'account_age'
      ? `Withdrawals open ${gate.minAgeDays} days after your seller account is approved — from ${fmtDate(gate.unlockAt)}.`
      : `You changed your payout details recently. Withdrawals reopen ${fmtDateTime(gate.freezeUntil)}.`
    : overview?.negative
      ? 'Your balance is below zero after a refund. Withdrawals reopen once new sales bring it back above zero.'
      : null

  /** Sticky summary rail — balance, and once a method is chosen, the maths. */
  const summaryRail = (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-lg border border-border-subtle card-frost p-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-success" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Available
          </span>
        </div>
        <p className="mt-1.5 text-3xl font-bold text-text-primary">
          ${(availableBalance ?? 0).toFixed(2)}
        </p>
        <p className="mt-1 text-[12px] text-text-tertiary">Ready to withdraw.</p>
        {overview && (
          <dl className="mt-3 space-y-1.5 border-t border-border-subtle pt-3 text-[12px]">
            {overview.pending > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Pending release{overview.nextMaturityAt ? ` · ${fmtDateTime(overview.nextMaturityAt)}` : ''}</dt>
                <dd className="tabular-nums font-semibold text-text-primary">${overview.pending.toFixed(2)}</dd>
              </div>
            )}
            {overview.frozen > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Set aside for open disputes</dt>
                <dd className="tabular-nums font-semibold text-text-primary">${overview.frozen.toFixed(2)}</dd>
              </div>
            )}
            {overview.locked > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">In a withdrawal in progress</dt>
                <dd className="tabular-nums font-semibold text-text-primary">${overview.locked.toFixed(2)}</dd>
              </div>
            )}
            {overview.wallet > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Store credit (included)</dt>
                <dd className="tabular-nums font-semibold text-text-primary">${overview.wallet.toFixed(2)}</dd>
              </div>
            )}
            {overview.negative && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Balance after refunds</dt>
                <dd className="tabular-nums font-semibold text-error">-${Math.abs(overview.available).toFixed(2)}</dd>
              </div>
            )}
          </dl>
        )}
        {gateMessage && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-[12px] leading-relaxed text-text-secondary">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            {gateMessage}
          </p>
        )}
      </div>

      {selectedMethod ? (
        <>
          <div className="rounded-lg border border-border-subtle card-frost p-4">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Amount</span>
                <span className="font-semibold text-text-primary">${amountNum.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Fee{quote ? ` (${feeTerms(quote)})` : ''}</span>
                <span className="font-semibold text-text-primary">-${fee.toFixed(2)}</span>
              </div>
              {quote?.minimum != null && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-tertiary">Minimum withdrawal</span>
                  <span className="text-text-tertiary">${quote.minimum.toFixed(2)}</span>
                </div>
              )}
              {quote && !quote.ok && amountNum > 0 && quote.message && (
                <p className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-[12px] leading-relaxed text-text-secondary">{quote.message}</p>
              )}
              <div className="my-2 h-px bg-border-subtle" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  You Receive
                </span>
                <span className="text-2xl font-bold text-lime-text">${netAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !amount || amountNum <= 0 || !quote?.ok}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-lime px-6 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <>Review Withdrawal <ArrowDownToLine className="h-4 w-4" /></>
                )}
              </button>
              <button
                onClick={() => { setSelectedMethod(null); setAmount(''); setQuote(null) }}
                disabled={isSubmitting}
                className="min-h-[44px] w-full rounded-lg border border-border-default bg-bg-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-50"
              >
                Choose Another Method
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border-subtle card-frost p-4">
            <p className="flex items-start gap-2 text-[12px] text-text-secondary">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              {selectedMethod.method_type === 'crypto'
                ? 'Crypto transfers process within 24–48 hours after admin review.'
                : 'Payoneer transfers arrive within 1–3 business days after admin review.'}
            </p>
            <p className="flex items-start gap-2 text-[12px] text-text-secondary">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-text" />
              Reviewed by our team before any funds are sent.
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-border-subtle card-frost p-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            How Payouts Work
          </h2>
          <ol className="space-y-2 text-[12px] leading-relaxed text-text-secondary">
            <li>1. Choose how you want to be paid: crypto (pick the coin and network) or Payoneer.</li>
            <li>2. Enter the amount — it goes to the destination saved in your payout settings.</li>
            <li>3. The amount is set aside from your balance while our team reviews the request.</li>
            <li>4. Once sent, the payment reference appears in your wallet.</li>
          </ol>
        </div>
      )}
    </aside>
  )

  return (
    <div className="pb-12">
      {/* Same container as /account/wallet — this is a sub-page of it, so the
          heading lands on the same x as "Wallet". */}
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Header */}
        <div className="mb-5">
          <Link
            href="/account/wallet"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>
          <h1 className="text-[24px] font-extrabold tracking-[-0.3px] text-text-primary">
            Withdraw Funds
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            {selectedMethod
              ? `Withdraw to ${selectedMethod.display_name}.`
              : 'Choose how you want to receive your funds.'}
          </p>
        </div>

        {/* Two columns: the flow on the left, a persistent summary rail on the
            right. A single capped column left two-thirds of a wide screen
            empty and made the page look broken. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {/* Step 1 — pick a method */}
              {!selectedMethod && (
                <motion.div
                  key="select-method"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {isLoadingMethods ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-7 w-7 animate-spin text-lime-text" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {methods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => !method.coming_soon && handleMethodSelect(method)}
                          disabled={!!method.coming_soon}
                          aria-disabled={!!method.coming_soon}
                          className={cn(
                            'group flex items-center gap-3 rounded-lg border border-border-subtle card-frost p-4 text-left transition-colors',
                            method.coming_soon
                              ? 'cursor-not-allowed opacity-55'
                              : 'hover:border-lime-tint-border hover:bg-white/[0.07]',
                          )}
                        >
                          <CoinBadge
                            coin={method.coin}
                            methodName={method.method_name}
                            muted={!!method.coming_soon}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-text-primary">
                              {method.display_name}
                            </span>
                            {/* Fiat rails stay visible rather than vanishing —
                                a payout method a seller has used before simply
                                disappearing reads as a fault, not a roadmap. */}
                            <span className="mt-1 flex items-center gap-1.5">
                              {method.chain && !method.coming_soon && (
                                <span className="rounded border border-border-subtle bg-bg-raised px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                                  {method.chain}
                                </span>
                              )}
                              <span className="text-[11px] text-text-secondary">
                                {method.coming_soon ? 'Coming soon' : `Min $${method.min_withdrawal}`}
                              </span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2 — amount + destination */}
              {selectedMethod && (
                <motion.div
                  key="withdrawal-form"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {/* Chosen method */}
                  <div className="flex items-center gap-3 rounded-lg border border-border-subtle card-frost p-4">
                    <CoinBadge coin={selectedMethod.coin} methodName={selectedMethod.method_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {selectedMethod.display_name}
                      </p>
                      {selectedMethod.chain && (
                        <p className="mt-0.5 text-[11px] text-text-secondary">
                          {CHAIN_LABELS[selectedMethod.chain as keyof typeof CHAIN_LABELS] ??
                            selectedMethod.chain}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="rounded-lg border border-border-subtle card-frost p-5">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-text-tertiary">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min={selectedMethod.min_withdrawal}
                        max={Math.min(selectedMethod.max_withdrawal || Infinity, availableBalance ?? 0)}
                        step="0.01"
                        className="w-full rounded-lg border border-border-default bg-bg-base/60 py-2.5 pl-7 pr-16 text-lg font-semibold text-text-primary placeholder:text-text-disabled transition-colors focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
                      />
                      <button
                        type="button"
                        onClick={() => setAmount((availableBalance ?? 0).toFixed(2))}
                        className="absolute right-2 top-1/2 min-h-[36px] -translate-y-1/2 rounded-md border border-border-subtle px-2.5 py-1.5 text-[11px] font-semibold text-lime-text transition-colors hover:bg-lime/10"
                      >
                        Max
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[12px] text-text-secondary">
                      <span>Min ${selectedMethod.min_withdrawal.toFixed(2)}</span>
                      <span>Available ${(availableBalance ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Destination — the saved payout details, never typed here */}
                  <div className="rounded-lg border border-border-subtle card-frost p-5">
                    <h2 className="mb-3 text-sm font-bold text-text-primary">
                      {selectedMethod.method_type === 'crypto' ? 'Wallet Details' : 'Payout Details'}
                    </h2>
                    {savedDestination ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border-subtle bg-bg-raised px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{savedDestination.label}</p>
                          <p className={cn('mt-1 break-all text-[13px] text-text-primary', savedDestination.mono && 'font-mono')}>{savedDestination.value}</p>
                        </div>
                        <p className="text-[12px] text-text-secondary">
                          Paid to the destination saved in your{' '}
                          <Link href="/account/settings?tab=payouts" className="font-semibold text-lime-text hover:underline">payout settings</Link>.
                          Changing it pauses withdrawals for {overview ? '48' : '48'} hours.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        <p className="text-[12px] leading-relaxed text-text-secondary">
                          No {selectedMethod.method_type === 'crypto' ? `${(selectedMethod.coin ?? '').toUpperCase()} address on ${CHAIN_LABELS[selectedMethod.chain as keyof typeof CHAIN_LABELS] ?? selectedMethod.chain}` : 'Payoneer email'} saved yet.{' '}
                          <Link href="/account/settings?tab=payouts" className="font-semibold text-lime-text hover:underline">Add it in payout settings</Link>{' '}
                          — withdrawals open 48 hours after payout details change.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {summaryRail}
        </div>
      </div>

      {/* ── Review step ──
          The last gate before an irreversible transfer. Shows the FULL address
          in 4-character groups: address poisoning works precisely because
          people check only the first and last few characters, so truncating
          here would defeat the point of confirming at all. */}
      {selectedMethod && (
        <Dialog open={showConfirm} onOpenChange={(open) => !isSubmitting && setShowConfirm(open)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Confirm Withdrawal</DialogTitle>
            <DialogDescription>
              Check every character of the address. Crypto transfers can’t be reversed or
              refunded once sent.
            </DialogDescription>

            <div className="mt-4 space-y-4">
              {selectedMethod.method_type === 'crypto' && (
                <>
                  <div className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                      <span className="text-[12px] font-semibold text-text-primary">
                        Sending {(selectedMethod.coin ?? '').toUpperCase()} over{' '}
                        {CHAIN_LABELS[selectedMethod.chain as keyof typeof CHAIN_LABELS] ??
                          selectedMethod.chain}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[12px] text-text-secondary">Destination address</p>
                    <div className="rounded-lg border border-border-subtle bg-bg-raised px-3 py-2.5">
                      <p className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[13px] leading-relaxed text-text-primary">
                        {chunkAddress(savedDestination?.value ?? '').map((group, i) => (
                          <span key={i}>{group}</span>
                        ))}
                      </p>
                    </div>
                  </div>
                </>
              )}
              {selectedMethod.method_name === 'payoneer' && savedDestination && (
                <div>
                  <p className="mb-1.5 text-[12px] text-text-secondary">Payoneer account</p>
                  <div className="rounded-lg border border-border-subtle bg-bg-raised px-3 py-2.5 text-[13px] text-text-primary">{savedDestination.value}</div>
                </div>
              )}

              <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-raised/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Amount</span>
                  <span className="font-semibold text-text-primary">${amountNum.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Fee</span>
                  <span className="font-semibold text-text-primary">-${fee.toFixed(2)}</span>
                </div>
                <div className="h-px bg-border-subtle" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    You Receive
                  </span>
                  <span className="text-lg font-bold text-lime-text">${netAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[12px] text-text-tertiary">
                The amount is set aside from your balance while our team reviews this request. If it’s declined, it
                returns to your available balance.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-50"
                >
                  Go Back
                </button>
                <button
                  onClick={submitRequest}
                  disabled={isSubmitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
