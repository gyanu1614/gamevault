'use client'

import { validatePayoutAddress, CHAIN_LABELS, chunkAddress } from '@/lib/crypto/address-validation'
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
// Ledger-backed withdrawable balance (funds-flow cutover): seller_available
// (released sale proceeds) + user_wallet (store credit) — the exact pool the
// withdrawal hold draws against. Replaces the old sum-of-completed-orders
// figure that ignored prior withdrawals.
import { getMyWithdrawableBalance } from '@/lib/actions/wallet-ledger'
import {
  getWithdrawalMethods,
  calculateWithdrawalFee,
  createWithdrawalRequest,
  type WithdrawalMethod
} from '@/lib/actions/withdrawals'

// Payment method icons mapping
export default function WithdrawPage() {
  const router = useRouter()
  const { user } = useAuth()
  // null = still loading; number = ledger-derived withdrawable total.
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)

  const [methods, setMethods] = useState<WithdrawalMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null)
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState<number>(0)
  const [netAmount, setNetAmount] = useState<number>(0)
  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoadingMethods, setIsLoadingMethods] = useState(true)

  useEffect(() => {
    loadMethods()
  }, [])

  // Load the withdrawable balance from the ledger.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = await getMyWithdrawableBalance()
      if (!cancelled) {
        setAvailableBalance(result.success && result.balance ? result.balance.total : 0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Calculate fee when amount changes
  useEffect(() => {
    const calculateFee = async () => {
      if (amount && selectedMethod && parseFloat(amount) > 0) {
        const result = await calculateWithdrawalFee(parseFloat(amount), selectedMethod.id)
        if (result.success && result.fee !== undefined && result.net !== undefined) {
          setFee(result.fee)
          setNetAmount(result.net)
        }
      } else {
        setFee(0)
        setNetAmount(0)
      }
    }

    const debounce = setTimeout(calculateFee, 300)
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

  /** Example address shape, so sellers can eyeball a wrong-chain paste. */
  const addressPlaceholder = (chain?: string | null) => {
    switch (chain) {
      case 'bitcoin':  return 'bc1… or 1… / 3…'
      case 'tron':     return 'T…'
      case 'ethereum':
      case 'polygon':  return '0x…'
      default:         return 'Enter your wallet address'
    }
  }

  const handleMethodSelect = (method: WithdrawalMethod) => {
    setSelectedMethod(method)
    setAmount('')
    setPaymentDetails({})
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

    // Validate payment details
    const requiredFields = getRequiredFields(selectedMethod.method_type)
    for (const field of requiredFields) {
      if (!paymentDetails[field.key]?.trim()) {
        toast.error(`${field.label} is required`)
        return
      }
    }

    // Crypto sends can't be reversed, so the destination is checked here for
    // fast feedback AND again server-side, which is the authoritative gate.
    if (selectedMethod.method_type === 'crypto') {
      const check = validatePayoutAddress(
        selectedMethod.coin ?? '',
        selectedMethod.chain ?? '',
        paymentDetails.wallet_address ?? '',
      )
      if (!check.valid) {
        toast.error(check.error || 'Invalid wallet address')
        return
      }
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
      const result = await createWithdrawalRequest({
        amount: amountNum,
        methodId: selectedMethod.id,
        paymentDetails:
          selectedMethod.method_type === 'crypto'
            ? {
                wallet_address: (paymentDetails.wallet_address ?? '').trim(),
                network: selectedMethod.chain ?? '',
              }
            : paymentDetails,
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

  const getRequiredFields = (methodType: string) => {
    if (methodType === 'crypto') {
      // Address only. `network` used to be a free-text box placeholdered
      // "e.g., ERC20, TRC20" — which is how a live request ended up asking
      // for BITCOIN over TRON. The network is a property of the method the
      // seller picked, so it is derived, never typed.
      return [
        {
          key: 'wallet_address',
          label: `${(selectedMethod?.coin ?? '').toUpperCase() || 'Wallet'} Address`,
          placeholder: addressPlaceholder(selectedMethod?.chain),
        },
      ]
    } else if (selectedMethod?.method_name === 'bank_transfer') {
      return [
        { key: 'account_name', label: 'Account Holder Name', placeholder: 'Johnathan Doe' },
        { key: 'account_number', label: 'Account Number', placeholder: '**** **** **** 4590' },
        { key: 'bank_name', label: 'Bank Name', placeholder: 'Global Royal Bank' },
        { key: 'routing_number', label: 'Routing Number', placeholder: 'Enter routing number' }
      ]
    } else if (selectedMethod?.method_name === 'paypal' || selectedMethod?.method_name === 'payoneer') {
      return [
        { key: 'email', label: 'Email Address', placeholder: 'your@email.com' }
      ]
    }
    return []
  }

  if (availableBalance === null) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
      </div>
    )
  }

  const requiredFields = selectedMethod ? getRequiredFields(selectedMethod.method_type) : []
  const amountNum = parseFloat(amount) || 0

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
                <span className="text-text-secondary">Processing fee</span>
                <span className="font-semibold text-text-primary">-${fee.toFixed(2)}</span>
              </div>
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
                disabled={isSubmitting || !amount || amountNum <= 0}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-lime px-6 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <>Review Withdrawal <ArrowDownToLine className="h-4 w-4" /></>
                )}
              </button>
              <button
                onClick={() => { setSelectedMethod(null); setAmount(''); setPaymentDetails({}) }}
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
                : 'Bank/PayPal transfers arrive within 1–3 business days after admin review.'}
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
            <li>1. Pick the coin and network you want to be paid in.</li>
            <li>2. Enter the amount and your wallet address.</li>
            <li>3. We hold the balance and review the request.</li>
            <li>4. Once sent, the transaction hash appears in your wallet.</li>
          </ol>
        </div>
      )}
    </aside>
  )

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-12">
      {/* Same container as /account/wallet — this is a sub-page of it, so the
          heading lands on the same x as "Wallet". */}
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        {/* Header */}
        <div className="mb-5 pt-2">
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

                  {/* Destination */}
                  {requiredFields.length > 0 && (
                    <div className="rounded-lg border border-border-subtle card-frost p-5">
                      <h2 className="mb-3 text-sm font-bold text-text-primary">
                        {selectedMethod.method_type === 'crypto' ? 'Wallet Details' : 'Payout Details'}
                      </h2>
                      <div className="space-y-3">
                        {/* Wrong-network sends are the most common way to lose
                            crypto permanently and are unrecoverable. State the
                            network BEFORE the address field, not after. */}
                        {selectedMethod.method_type === 'crypto' && selectedMethod.chain && (
                          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2.5">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            <p className="text-[12px] leading-relaxed text-text-secondary">
                              Send only over{' '}
                              <span className="font-semibold text-text-primary">
                                {CHAIN_LABELS[selectedMethod.chain as keyof typeof CHAIN_LABELS] ??
                                  selectedMethod.chain}
                              </span>
                              . Funds sent to an address on any other network can’t be recovered.
                            </p>
                          </div>
                        )}

                        {requiredFields.map((field) => {
                          const value = paymentDetails[field.key] || ''
                          const check =
                            selectedMethod.method_type === 'crypto' && value.trim()
                              ? validatePayoutAddress(
                                  selectedMethod.coin ?? '',
                                  selectedMethod.chain ?? '',
                                  value,
                                )
                              : null
                          const invalid = check ? !check.valid : false

                          return (
                            <div key={field.key}>
                              <label className="mb-1 block text-[12px] font-medium text-text-secondary">
                                {field.label}
                              </label>
                              <input
                                type="text"
                                spellCheck={false}
                                autoComplete="off"
                                value={value}
                                onChange={(e) => setPaymentDetails({ ...paymentDetails, [field.key]: e.target.value })}
                                placeholder={field.placeholder}
                                className={cn(
                                  'w-full rounded-lg border bg-bg-base/60 px-3 py-2.5 font-mono text-sm text-text-primary transition-colors placeholder:font-sans placeholder:text-text-disabled focus:outline-none focus:ring-2',
                                  invalid
                                    ? 'border-error/50 focus:border-error focus:ring-error/20'
                                    : 'border-border-default focus:border-lime focus:ring-lime/20',
                                )}
                              />
                              {check && !check.valid && (
                                <p className="mt-1 text-[12px] text-error">{check.error}</p>
                              )}
                              {check?.valid && (
                                <p className="mt-1 text-[12px] text-lime-text">Address looks valid.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
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
                        {chunkAddress(paymentDetails.wallet_address ?? '').map((group, i) => (
                          <span key={i}>{group}</span>
                        ))}
                      </p>
                    </div>
                  </div>
                </>
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
                Your balance is held while an admin reviews this request. If it’s rejected, the
                funds return to your available balance.
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
