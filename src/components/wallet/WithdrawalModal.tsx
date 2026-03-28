'use client'

import React, { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, DollarSign, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import {
  getWithdrawalMethods,
  calculateWithdrawalFee,
  createWithdrawalRequest,
  type WithdrawalMethod
} from '@/lib/actions/withdrawals'

interface WithdrawalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  currentBalance: number
}

export default function WithdrawalModal({
  isOpen,
  onClose,
  onSuccess,
  currentBalance
}: WithdrawalModalProps) {
  const [mounted, setMounted] = useState(false)
  const [methods, setMethods] = useState<WithdrawalMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null)
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState<number>(0)
  const [netAmount, setNetAmount] = useState<number>(0)
  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingMethods, setIsLoadingMethods] = useState(true)
  const [step, setStep] = useState<'method' | 'amount' | 'details' | 'confirm'>('method')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadMethods()
    } else {
      // Reset form when modal closes
      setStep('method')
      setSelectedMethod(null)
      setAmount('')
      setFee(0)
      setNetAmount(0)
      setPaymentDetails({})
    }
  }, [isOpen])

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
    setStep('amount')
  }

  const handleAmountNext = () => {
    const amountNum = parseFloat(amount)
    if (!selectedMethod) return

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (amountNum < selectedMethod.min_withdrawal) {
      toast.error(`Minimum withdrawal is $${selectedMethod.min_withdrawal}`)
      return
    }

    if (selectedMethod.max_withdrawal > 0 && amountNum > selectedMethod.max_withdrawal) {
      toast.error(`Maximum withdrawal is $${selectedMethod.max_withdrawal}`)
      return
    }

    if (amountNum > currentBalance) {
      toast.error('Insufficient balance')
      return
    }

    setStep('details')
  }

  const handleDetailsNext = () => {
    // Validate payment details based on method
    if (selectedMethod?.method_name === 'bank_transfer') {
      if (!paymentDetails.account_holder || !paymentDetails.account_number || !paymentDetails.routing_number) {
        toast.error('Please fill in all bank account details')
        return
      }
    } else if (selectedMethod?.method_name === 'paypal' || selectedMethod?.method_name === 'payoneer') {
      if (!paymentDetails.email) {
        toast.error('Please enter your email address')
        return
      }
    } else if (selectedMethod?.method_type === 'crypto') {
      if (!paymentDetails.wallet_address) {
        toast.error('Please enter your wallet address')
        return
      }
    }

    setStep('confirm')
  }

  const handleSubmit = async () => {
    if (!selectedMethod) return

    setIsSubmitting(true)

    try {
      const result = await createWithdrawalRequest({
        amount: parseFloat(amount),
        methodId: selectedMethod.id,
        paymentDetails
      })

      if (result.success) {
        toast.success('Withdrawal request submitted! Awaiting admin approval.')
        if (onSuccess) onSuccess()
        onClose()
      } else {
        throw new Error(result.error || 'Failed to create withdrawal request')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit withdrawal request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-white/[0.05]">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/[0.05] text-gray-400 hover:text-white transition-all disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <DollarSign className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Withdraw Funds
                  </h2>
                  <p className="text-sm text-gray-400">
                    Available balance: ${currentBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Steps indicator */}
            <div className="px-6 pt-4 pb-2 flex items-center gap-2">
              {['method', 'amount', 'details', 'confirm'].map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={cn(
                    "w-full h-1 rounded-full transition-all",
                    ['method', 'amount', 'details', 'confirm'].indexOf(step) >= i
                      ? "bg-violet-500"
                      : "bg-white/10"
                  )} />
                </div>
              ))}
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Step 1: Method Selection */}
              {step === 'method' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Select withdrawal method</h3>
                  {isLoadingMethods ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {methods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => handleMethodSelect(method)}
                          className="w-full p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-violet-500/40 hover:bg-white/[0.05] transition-all text-left group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-white group-hover:text-violet-300 transition-colors">
                                {method.display_name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">{method.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                <span>Fee: {method.fee_percentage}% + ${method.fee_fixed}</span>
                                <span>•</span>
                                <span>{method.processing_time}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Amount Input */}
              {step === 'amount' && selectedMethod && (
                <div className="space-y-4">
                  <button
                    onClick={() => setStep('method')}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ← Change method
                  </button>

                  <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <p className="text-sm text-violet-300 font-medium">{selectedMethod.display_name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Min: ${selectedMethod.min_withdrawal} • Max: ${selectedMethod.max_withdrawal || 'No limit'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Withdrawal amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={currentBalance}
                        className="w-full pl-8 pr-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {amount && parseFloat(amount) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount</span>
                        <span className="text-white font-mono">${parseFloat(amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Fee</span>
                        <span className="text-amber-400 font-mono">-${fee.toFixed(2)}</span>
                      </div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-300 font-medium">You'll receive</span>
                        <span className="text-emerald-400 font-semibold font-mono">${netAmount.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}

                  <button
                    onClick={handleAmountNext}
                    disabled={!amount || parseFloat(amount) <= 0}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold transition-all",
                      amount && parseFloat(amount) > 0
                        ? "bg-violet-500 hover:bg-violet-600 text-white"
                        : "bg-white/[0.05] text-gray-500 cursor-not-allowed"
                    )}
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Step 3: Payment Details */}
              {step === 'details' && selectedMethod && (
                <div className="space-y-4">
                  <button
                    onClick={() => setStep('amount')}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ← Back
                  </button>

                  <h3 className="text-sm font-medium text-gray-300">Payment details</h3>

                  {selectedMethod.method_name === 'bank_transfer' && (
                    <>
                      <input
                        type="text"
                        value={paymentDetails.account_holder || ''}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, account_holder: e.target.value })}
                        placeholder="Account holder name"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                      <input
                        type="text"
                        value={paymentDetails.account_number || ''}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, account_number: e.target.value })}
                        placeholder="Account number"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                      <input
                        type="text"
                        value={paymentDetails.routing_number || ''}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, routing_number: e.target.value })}
                        placeholder="Routing number"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </>
                  )}

                  {(selectedMethod.method_name === 'paypal' || selectedMethod.method_name === 'payoneer') && (
                    <input
                      type="email"
                      value={paymentDetails.email || ''}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, email: e.target.value })}
                      placeholder="Email address"
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  )}

                  {selectedMethod.method_type === 'crypto' && (
                    <>
                      <input
                        type="text"
                        value={paymentDetails.wallet_address || ''}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, wallet_address: e.target.value })}
                        placeholder="Wallet address"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono text-sm"
                      />
                      <input
                        type="text"
                        value={paymentDetails.network || ''}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, network: e.target.value })}
                        placeholder="Network (e.g., ERC-20, TRC-20)"
                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.1] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </>
                  )}

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-200">
                      Double-check your payment details. Incorrect information may delay or prevent your withdrawal.
                    </p>
                  </div>

                  <button
                    onClick={handleDetailsNext}
                    className="w-full py-3 rounded-xl font-semibold bg-violet-500 hover:bg-violet-600 text-white transition-all"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Step 4: Confirmation */}
              {step === 'confirm' && selectedMethod && (
                <div className="space-y-4">
                  <button
                    onClick={() => setStep('details')}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                    disabled={isSubmitting}
                  >
                    ← Back
                  </button>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                    <h3 className="text-sm font-medium text-gray-300">Review your withdrawal</h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Method</span>
                        <span className="text-white">{selectedMethod.display_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount</span>
                        <span className="text-white font-mono">${parseFloat(amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Fee</span>
                        <span className="text-amber-400 font-mono">-${fee.toFixed(2)}</span>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between">
                        <span className="text-gray-300 font-medium">You'll receive</span>
                        <span className="text-emerald-400 font-semibold font-mono">${netAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Processing time</span>
                        <span className="text-white text-xs">{selectedMethod.processing_time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">
                      All withdrawals require admin approval. You'll receive a notification once processed.
                    </p>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                      isSubmitting
                        ? "bg-white/[0.05] text-gray-500 cursor-not-allowed"
                        : "bg-violet-500 hover:bg-violet-600 text-white"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Withdrawal Request'
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
