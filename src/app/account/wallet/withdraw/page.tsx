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
import { useSellerEarnings } from '@/hooks/use-seller-earnings'
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
  const { stats: earningsStats, isLoading: isLoadingEarnings } = useSellerEarnings()

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

    if (amountNum > earningsStats.available_balance) {
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

  if (isLoadingEarnings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/account/wallet"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>

          <h1 className="text-2xl font-bold text-white">Withdraw Funds</h1>
          <p className="text-sm text-gray-400 mt-1">Choose your preferred withdrawal method to manage your assets.</p>
        </div>

        {/* Balance Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {/* Available Balance */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[10px] text-emerald-400/70 font-semibold uppercase tracking-wider">Available</p>
            </div>
            <p className="text-2xl font-bold text-white">${earningsStats.available_balance.toFixed(2)}</p>
          </div>

          {/* Pending Balance */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Pending</p>
            </div>
            <p className="text-2xl font-bold text-gray-400">${earningsStats.pending_balance.toFixed(2)}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Select Method */}
          {!selectedMethod && (
            <motion.div
              key="select-method"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isLoadingMethods ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {methods.map((method) => {
                    const iconPath = getMethodIcon(method.method_name)
                    const isCustomIcon = iconPath !== '/payment-methods/default.png'

                    return (
                      <button
                        key={method.id}
                        onClick={() => handleMethodSelect(method)}
                        className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/40 p-4 transition-all aspect-square"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 group-hover:bg-violet-500/20 transition-colors">
                          {isCustomIcon ? (
                            <Image
                              src={iconPath}
                              alt={method.display_name}
                              width={28}
                              height={28}
                              className="object-contain"
                            />
                          ) : (
                            <Building2 className="h-6 w-6 text-violet-400" />
                          )}
                        </div>
                        <div className="text-center">
                          <h3 className="text-xs font-semibold text-white">{method.display_name}</h3>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2 & 3: Amount & Details (Combined) */}
          {selectedMethod && (
            <motion.div
              key="withdrawal-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid lg:grid-cols-2 gap-6"
            >
              {/* Left Column: Form */}
              <div className="space-y-6">
                {/* Amount Details */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-1 rounded-full bg-violet-500"></div>
                    <h2 className="text-lg font-bold text-white">Amount Details</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                        Withdrawal Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          min={selectedMethod.min_withdrawal}
                          max={Math.min(selectedMethod.max_withdrawal || Infinity, earningsStats.available_balance)}
                          step="0.01"
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-lg font-semibold text-white placeholder:text-white/20 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">USD</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                        Payment Fees
                      </label>
                      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
                        <span className="text-lg font-semibold text-white">${fee.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      You Receive
                    </label>
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                      <span className="text-2xl font-bold text-violet-400">${netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Details Form */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-1 rounded-full bg-violet-500"></div>
                    <h2 className="text-lg font-bold text-white">
                      {selectedMethod.method_type === 'crypto' ? 'Wallet Details' : 'Bank Details'}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {getRequiredFields(selectedMethod.method_type).map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={paymentDetails[field.key] || ''}
                          onChange={(e) =>
                            setPaymentDetails({ ...paymentDetails, [field.key]: e.target.value })
                          }
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedMethod(null)
                      setAmount('')
                      setPaymentDetails({})
                    }}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                    className="flex-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-violet-500/50 disabled:to-purple-600/50 px-6 py-3 text-sm font-semibold text-white transition-all shadow-lg hover:shadow-violet-500/25 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Confirm Withdrawal
                        <ArrowDownToLine className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Summary */}
              <div className="space-y-6">
                {/* Transaction Summary */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                  <h3 className="text-base font-bold text-white mb-4">Transaction Summary</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Minimum withdrawal</span>
                      <span className="font-semibold text-white">${selectedMethod.min_withdrawal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Processing fee</span>
                      <span className="font-semibold text-white">${fee.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Exchange rate</span>
                      <span className="font-semibold text-white">1 USD = 1.00 USD</span>
                    </div>

                    <div className="h-px bg-white/10 my-3" />

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300 uppercase tracking-wide">Total to Receive</span>
                      <span className="text-2xl font-bold text-violet-400">${netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Processing Time */}
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 flex-shrink-0">
                      <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-400 mb-1">Processing Time</p>
                      <p className="text-xs text-blue-400/70 leading-relaxed">
                        {selectedMethod.method_type === 'crypto'
                          ? 'Crypto transfers are typically processed within 24-48 hours. Please ensure all details are correct to avoid delays.'
                          : 'Bank transfers are typically curated and delivered within 1-3 business days. Please ensure all details are precise to avoid royal delays.'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-purple-500/5 p-5">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 flex-shrink-0">
                      <Shield className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-violet-400 mb-1">Regal Security</p>
                      <p className="text-xs text-violet-400/70 leading-relaxed">
                        Your assets are protected by top-tier military-grade encryption.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
