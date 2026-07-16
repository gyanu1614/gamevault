'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
  Building2,
  Bitcoin,
  DollarSign,
  ArrowDownToLine,
  Clock,
  Shield
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
const PAYMENT_ICONS: Record<string, string> = {
  'bank_transfer': '/payment-methods/bank.png',
  'paypal': '/payment-methods/paypal.png',
  'payoneer': '/payment-methods/payoneer.png',
  'btc': '/payment-methods/btc.png',
  'eth': '/payment-methods/eth.png',
  'usdc_erc20': '/payment-methods/usdc.png',
  'usdc_trc20': '/payment-methods/usdc.png',
}

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

    setIsSubmitting(true)
    try {
      const result = await createWithdrawalRequest({
        amount: amountNum,
        methodId: selectedMethod.id,
        paymentDetails
      })

      if (result.success) {
        toast.success('Withdrawal request submitted! Admin will review it shortly.')
        router.push('/account/wallet')
      } else {
        toast.error(result.error || 'Failed to create withdrawal request')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRequiredFields = (methodType: string) => {
    if (methodType === 'crypto') {
      return [
        { key: 'wallet_address', label: 'Wallet Address', placeholder: 'Enter your wallet address' },
        { key: 'network', label: 'Network', placeholder: 'e.g., ERC20, TRC20' }
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

  const getMethodIcon = (methodName: string) => {
    return PAYMENT_ICONS[methodName] || '/payment-methods/default.png'
  }

  if (availableBalance === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
      </div>
    )
  }

  const requiredFields = selectedMethod ? getRequiredFields(selectedMethod.method_type) : []

  return (
    // V22 — Withdraw revamp: single focused column, hero-glass cards,
    // rounded-lg, lime brand, compact density. No bg-black slab.
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5">
          <Link
            href="/account/wallet"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Withdraw Funds</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {selectedMethod
              ? `Withdraw to ${selectedMethod.display_name}.`
              : 'Choose how you want to receive your funds.'}
          </p>
        </div>

        {/* Available balance strip */}
        <div className="mb-5 flex items-center justify-between rounded-lg border border-border-subtle card-frost py-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-success" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Available</span>
          </div>
          <span className="text-xl font-bold text-text-primary">${(availableBalance ?? 0).toFixed(2)}</span>
        </div>

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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {methods.map((method) => {
                    const iconPath = getMethodIcon(method.method_name)
                    const isCustomIcon = iconPath !== '/payment-methods/default.png'
                    return (
                      <button
                        key={method.id}
                        onClick={() => handleMethodSelect(method)}
                        className="group flex items-center gap-3 rounded-lg border border-border-subtle card-frost text-left transition-colors hover:border-lime-tint-border hover:bg-white/[0.07]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-lime-tint-border bg-lime/10">
                          {isCustomIcon ? (
                            <Image src={iconPath} alt={method.display_name} width={22} height={22} className="object-contain" />
                          ) : (
                            <Building2 className="h-5 w-5 text-lime-text" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-text-primary">{method.display_name}</span>
                          <span className="block text-[11px] text-text-secondary">Min ${method.min_withdrawal}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2 — amount + details (single focused column) */}
          {selectedMethod && (
            <motion.div
              key="withdrawal-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
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
                    className="w-full rounded-lg border border-border-default bg-bg-base/60 py-2.5 pl-7 pr-16 text-lg font-semibold text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount((availableBalance ?? 0).toFixed(2))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border-subtle px-2 py-1 text-[11px] font-semibold text-lime-text transition-colors hover:bg-lime/10"
                  >
                    Max
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[12px] text-text-secondary">
                  <span>Min ${selectedMethod.min_withdrawal.toFixed(2)}</span>
                  <span>Available ${(availableBalance ?? 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Payout details */}
              {requiredFields.length > 0 && (
                <div className="rounded-lg border border-border-subtle card-frost p-5">
                  <h2 className="mb-3 text-sm font-bold text-text-primary">
                    {selectedMethod.method_type === 'crypto' ? 'Wallet Details' : 'Payout Details'}
                  </h2>
                  <div className="space-y-3">
                    {requiredFields.map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-[12px] font-medium text-text-secondary">{field.label}</label>
                        <input
                          type="text"
                          value={paymentDetails[field.key] || ''}
                          onChange={(e) => setPaymentDetails({ ...paymentDetails, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-border-default bg-bg-base/60 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="rounded-lg border border-border-subtle card-frost p-5">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Withdrawal amount</span>
                    <span className="font-semibold text-text-primary">${(parseFloat(amount) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Processing fee</span>
                    <span className="font-semibold text-text-primary">-${fee.toFixed(2)}</span>
                  </div>
                  <div className="my-2 h-px bg-border-subtle" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">You Receive</span>
                    <span className="text-2xl font-bold text-lime-text">${netAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Processing-time note */}
              <p className="flex items-center gap-2 text-[12px] text-text-secondary">
                <Clock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                {selectedMethod.method_type === 'crypto'
                  ? 'Crypto transfers process within 24–48 hours after admin review.'
                  : 'Bank/PayPal transfers arrive within 1–3 business days after admin review.'}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedMethod(null); setAmount(''); setPaymentDetails({}) }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-border-default bg-bg-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime px-6 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                  ) : (
                    <>Confirm Withdrawal <ArrowDownToLine className="h-4 w-4" /></>
                  )}
                </button>
              </div>

              {/* Security note */}
              <p className="flex items-center justify-center gap-1.5 text-[12px] text-text-tertiary">
                <Shield className="h-3.5 w-3.5 text-lime-text" />
                Encrypted & reviewed by our team before payout.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
