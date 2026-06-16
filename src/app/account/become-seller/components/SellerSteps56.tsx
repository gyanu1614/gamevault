/**
 * Seller Registration - Steps 5 & 6
 *
 * Step 5: Payment & Banking
 * - Payout method selection (Bank Transfer, PayPal, Cryptocurrency)
 * - Conditional fields based on payout method
 * - Tax information and residency
 *
 * Step 6: Agreements & Final Review
 * - Commission tiers display
 * - All required agreements (7 checkboxes)
 * - Final confirmations
 * - Submit application
 */

'use client'

import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, ChevronLeft, CreditCard, Check, Rocket, Loader2 } from 'lucide-react'

import { step5Schema, step6Schema, type Step5FormData, type Step6FormData } from '../schemas'
import { COMMISSION_TIERS } from '../constants'

interface SellerSteps56Props {
  currentStep: number
  onStepComplete: (step: number, data: Step5FormData | Step6FormData) => void
  onStepBack?: () => void
  onSubmitApplication?: (step6Data: Step6FormData) => void
  isSubmitting?: boolean
  initialData?: {
    step5?: Partial<Step5FormData>
    step6?: Partial<Step6FormData>
  }
}

export default function SellerSteps56({
  currentStep,
  onStepComplete,
  onStepBack,
  onSubmitApplication,
  isSubmitting = false,
  initialData,
}: SellerSteps56Props) {
  // Step 5 Form
  const {
    register: register5,
    handleSubmit: handleSubmit5,
    formState: { errors: errors5 },
    watch: watch5,
    setValue: setValue5,
  } = useForm<Step5FormData>({
    resolver: zodResolver(step5Schema),
    defaultValues: initialData?.step5 || {},
  })

  const payoutMethod = watch5('payoutMethod')

  const onSubmitStep5 = (data: Step5FormData) => {
    console.log('Step 5 data:', data)
    onStepComplete(5, data)
  }

  // Step 6 Form
  const {
    register: register6,
    handleSubmit: handleSubmit6,
    formState: { errors: errors6 },
    watch: watch6,
    setValue: setValue6,
  } = useForm<Step6FormData>({
    resolver: zodResolver(step6Schema),
    defaultValues: initialData?.step6 || {},
  })

  const onSubmitStep6 = (data: Step6FormData) => {
    console.log('Step 6 data:', data)
    console.log('All application data submitted!')
    onStepComplete(6, data)
    if (onSubmitApplication) {
      // Pass step6 data directly to avoid race condition with state updates
      onSubmitApplication(data)
    }
  }

  return (
    <>
      {/* Step 5: Payment & Banking */}
      {currentStep === 5 && (
        <motion.div
          key="seller-step5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit5(onSubmitStep5)} className="space-y-5 sm:space-y-6">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-5 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  Payment & Banking
                </h2>
                <p className="mt-1.5 text-xs text-text-secondary sm:text-sm">
                  Set up your payout method and tax information
                </p>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {/* Payout Method Selection */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Payout Method</h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setValue5('payoutMethod', 'bank_transfer')}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        payoutMethod === 'bank_transfer'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                      }`}
                    >
                      <CreditCard
                        className={`mb-2 h-6 w-6 ${
                          payoutMethod === 'bank_transfer' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h4 className="text-sm font-semibold text-white">Bank Transfer</h4>
                      <p className="mt-1 text-xs text-text-secondary">ACH/Wire transfer</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue5('payoutMethod', 'paypal')}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        payoutMethod === 'paypal'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                      }`}
                    >
                      <CreditCard
                        className={`mb-2 h-6 w-6 ${
                          payoutMethod === 'paypal' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h4 className="text-sm font-semibold text-white">PayPal</h4>
                      <p className="mt-1 text-xs text-text-secondary">PayPal account</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue5('payoutMethod', 'cryptocurrency')}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        payoutMethod === 'cryptocurrency'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                      }`}
                    >
                      <CreditCard
                        className={`mb-2 h-6 w-6 ${
                          payoutMethod === 'cryptocurrency' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h4 className="text-sm font-semibold text-white">Cryptocurrency</h4>
                      <p className="mt-1 text-xs text-text-secondary">BTC, ETH, USDT</p>
                    </button>
                  </div>
                  <input type="hidden" {...register5('payoutMethod')} />
                  {errors5.payoutMethod && (
                    <p className="text-xs text-error">{errors5.payoutMethod.message}</p>
                  )}
                </div>

                {/* Bank Transfer Fields */}
                {payoutMethod === 'bank_transfer' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 sm:space-y-5"
                  >
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">
                        Bank Account Details
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Account Holder Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('accountHolderName')}
                          placeholder="Full name on account"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Bank Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('bankName')}
                          placeholder="e.g., Chase Bank"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Account Number <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('accountNumber')}
                          placeholder="Account number"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Routing Code
                        </label>
                        <input
                          type="text"
                          {...register5('routingCode')}
                          placeholder="9-digit routing number"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          SWIFT Code <span className="text-text-secondary">(International)</span>
                        </label>
                        <input
                          type="text"
                          {...register5('swiftCode')}
                          placeholder="SWIFT/BIC code"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          IBAN <span className="text-text-secondary">(International)</span>
                        </label>
                        <input
                          type="text"
                          {...register5('iban')}
                          placeholder="International bank account number"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* PayPal Fields */}
                {payoutMethod === 'paypal' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 sm:space-y-5"
                  >
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">PayPal Details</h3>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        PayPal Email <span className="text-error">*</span>
                      </label>
                      <input
                        type="email"
                        {...register5('paypalEmail')}
                        placeholder="your-email@example.com"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors5.paypalEmail && (
                        <p className="mt-1.5 text-xs text-error">{errors5.paypalEmail.message}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Cryptocurrency Fields */}
                {payoutMethod === 'cryptocurrency' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 sm:space-y-5"
                  >
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">
                        Cryptocurrency Details
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Cryptocurrency Type <span className="text-error">*</span>
                        </label>
                        <select
                          {...register5('cryptoType')}
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        >
                          <option value="" className="bg-black">
                            Select cryptocurrency
                          </option>
                          <option value="BTC" className="bg-black">
                            Bitcoin (BTC)
                          </option>
                          <option value="ETH" className="bg-black">
                            Ethereum (ETH)
                          </option>
                          <option value="USDT" className="bg-black">
                            Tether (USDT)
                          </option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Wallet Address <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('cryptoWalletAddress')}
                          placeholder="Your cryptocurrency wallet address"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tax Information */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Tax Information</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Tax Residency Country <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        {...register5('taxResidencyCountry')}
                        placeholder="e.g., United States"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors5.taxResidencyCountry && (
                        <p className="mt-1.5 text-xs text-error">
                          {errors5.taxResidencyCountry.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Tax Form <span className="text-text-secondary">(If applicable)</span>
                      </label>
                      <select
                        {...register5('taxForm')}
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      >
                        <option value="none" className="bg-black">
                          Not applicable
                        </option>
                        <option value="w9" className="bg-black">
                          W-9 (US sellers)
                        </option>
                        <option value="w8ben" className="bg-black">
                          W-8BEN (International sellers)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4">
                    <p className="text-xs text-blue-200 sm:text-sm">
                      <span className="font-semibold">Security:</span> All payment information is
                      encrypted and stored securely. We never share your financial data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={onStepBack}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-xs font-medium text-white transition-all hover:bg-bg-overlay sm:gap-1.5 sm:px-4 sm:text-sm"
              >
                <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-5 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/20 sm:gap-1.5 sm:px-6 sm:text-sm"
              >
                Continue
                <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Step 6: Agreements & Final Review */}
      {currentStep === 6 && (
        <motion.div
          key="seller-step6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit6(onSubmitStep6)} className="space-y-5 sm:space-y-6">
            {/* Commission Tiers Card */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <h3 className="mb-3 text-center text-xs font-semibold text-white sm:text-sm">
                Commission Tiers
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                {COMMISSION_TIERS.map((tier) => (
                  <div
                    key={tier.tier}
                    className={`group relative overflow-hidden rounded-lg border border-white/5 bg-gradient-to-br ${tier.gradient} to-transparent p-2 transition-all hover:${tier.borderHover} sm:p-2.5`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${tier.bgHover} opacity-0 transition-opacity group-hover:opacity-100`} />
                    <div className="relative">
                      <div className={`mb-0.5 text-[8px] font-medium uppercase tracking-wider ${tier.textColor} sm:text-[9px]`}>
                        {tier.tier}
                      </div>
                      <div className="text-base font-bold text-white sm:text-lg">{tier.rate}</div>
                      <div className="mt-0.5 text-[8px] text-text-tertiary sm:text-[9px]">
                        {tier.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agreements Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-5 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  Agreements & Final Review
                </h2>
                <p className="mt-1.5 text-xs text-text-secondary sm:text-sm">
                  Please review and accept all agreements to complete your application
                </p>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {/* Agreements Section */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">
                      Required Agreements
                    </h3>
                  </div>

                  {[
                    {
                      name: 'acceptedSellerAgreement',
                      label: 'Seller Agreement & Terms of Service',
                      desc: 'I have read and agree to the Seller Agreement and Terms of Service',
                    },
                    {
                      name: 'acceptedPrivacyPolicy',
                      label: 'Privacy Policy',
                      desc: 'I have read and agree to the Privacy Policy',
                    },
                    {
                      name: 'acceptedAntiFraudPolicy',
                      label: 'Anti-Fraud Policy',
                      desc: 'I agree to comply with the Anti-Fraud Policy',
                    },
                    {
                      name: 'acceptedCommissionStructure',
                      label: 'Commission Structure',
                      desc: 'I understand and accept the commission structure',
                    },
                    {
                      name: 'acceptedDataProcessing',
                      label: 'Data Processing Agreement',
                      desc: 'I consent to data processing as per GDPR compliance',
                    },
                  ].map((agreement) => {
                    const fieldName = agreement.name as keyof Step6FormData
                    const isChecked = watch6(fieldName)
                    return (
                      <div key={agreement.name}>
                        <div className="flex items-start gap-3 sm:gap-3.5">
                          <button
                            type="button"
                            onClick={() => setValue6(fieldName, !isChecked)}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 sm:h-6 sm:w-6 ${
                              isChecked
                                ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                                : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                            }`}
                          >
                            {isChecked && (
                              <Check
                                className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4"
                                strokeWidth={3}
                              />
                            )}
                          </button>
                          <div className="flex-1">
                            <button
                              type="button"
                              className="cursor-pointer select-none text-left"
                              onClick={() => setValue6(fieldName, !isChecked)}
                            >
                              <span className="text-xs font-medium text-white sm:text-sm">
                                {agreement.label}
                              </span>
                              <p className="mt-0.5 text-[10px] text-text-secondary sm:text-xs">
                                {agreement.desc}
                              </p>
                            </button>
                          </div>
                        </div>
                        <input type="hidden" {...register6(fieldName)} />
                        {errors6[fieldName] && (
                          <p className="ml-8 mt-1 text-xs text-error sm:ml-9">
                            {errors6[fieldName]?.message}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Final Confirmations */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">
                      Final Confirmations
                    </h3>
                  </div>

                  {[
                    {
                      name: 'informationAccurate',
                      label: 'Information Accuracy',
                      desc: 'I confirm that all information provided is accurate and truthful',
                    },
                    {
                      name: 'understandConsequences',
                      label: 'Understanding of Consequences',
                      desc: 'I understand that providing false information may result in permanent ban',
                    },
                  ].map((confirmation) => {
                    const fieldName = confirmation.name as keyof Step6FormData
                    const isChecked = watch6(fieldName)
                    return (
                      <div key={confirmation.name}>
                        <div className="flex items-start gap-3 sm:gap-3.5">
                          <button
                            type="button"
                            onClick={() => setValue6(fieldName, !isChecked)}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 sm:h-6 sm:w-6 ${
                              isChecked
                                ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                                : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                            }`}
                          >
                            {isChecked && (
                              <Check
                                className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4"
                                strokeWidth={3}
                              />
                            )}
                          </button>
                          <div className="flex-1">
                            <button
                              type="button"
                              className="cursor-pointer select-none text-left"
                              onClick={() => setValue6(fieldName, !isChecked)}
                            >
                              <span className="text-xs font-medium text-white sm:text-sm">
                                {confirmation.label}
                              </span>
                              <p className="mt-0.5 text-[10px] text-text-secondary sm:text-xs">
                                {confirmation.desc}
                              </p>
                            </button>
                          </div>
                        </div>
                        <input type="hidden" {...register6(fieldName)} />
                        {errors6[fieldName] && (
                          <p className="ml-8 mt-1 text-xs text-error sm:ml-9">
                            {errors6[fieldName]?.message}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Important Notice */}
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 sm:p-4">
                  <p className="text-xs text-yellow-200 sm:text-sm">
                    <span className="font-semibold">Important:</span> By submitting this
                    application, you agree to all terms and acknowledge that your application will be
                    reviewed by our team. You will receive a confirmation email within 24-48 hours.
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={onStepBack}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-xs font-medium text-white transition-all hover:bg-bg-overlay sm:gap-1.5 sm:px-4 sm:text-sm"
              >
                <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1 rounded-lg border border-green-500 bg-success-bg px-5 py-2 text-xs font-medium text-success transition-all hover:bg-success-bg disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:px-6 sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    Submitting...
                    <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                  </>
                ) : (
                  <>
                    Submit Application
                    <Rocket className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </>
  )
}
