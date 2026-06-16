/**
 * Seller Registration - Steps 1 & 2
 *
 * Step 1: Eligibility & Intent
 * - Age verification (18+)
 * - Seller type selection (Individual/Business)
 * - Primary games selection
 * - Expected monthly volume
 * - Referral code (optional)
 * - Commission tiers display
 *
 * Step 2: Business Information
 * - Personal/Company details
 * - Contact information
 * - Conditional business fields
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronRight, ChevronLeft, User, Building2 } from 'lucide-react'

import { step1Schema, step2Schema, type Step1FormData, type Step2FormData } from '../schemas'
import { GAMES, COMMISSION_TIERS } from '../constants'

interface SellerSteps12Props {
  currentStep: number
  onStepComplete: (step: number, data: Step1FormData | Step2FormData) => void
  onStepBack?: () => void
  initialData?: {
    step1?: Partial<Step1FormData>
    step2?: Partial<Step2FormData>
  }
}

export default function SellerSteps12({
  currentStep,
  onStepComplete,
  onStepBack,
  initialData,
}: SellerSteps12Props) {
  // Step 1 Form
  const {
    register: register1,
    handleSubmit: handleSubmit1,
    formState: { errors: errors1 },
    watch: watch1,
    setValue: setValue1,
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      primaryGames: initialData?.step1?.primaryGames || [],
      is18OrOlder: initialData?.step1?.is18OrOlder || false,
      sellerType: initialData?.step1?.sellerType,
      expectedVolume: initialData?.step1?.expectedVolume,
      referralCode: initialData?.step1?.referralCode || '',
    },
  })

  const selectedGames = watch1('primaryGames') || []
  const sellerType = watch1('sellerType')
  const is18OrOlder = watch1('is18OrOlder')

  // Store seller type for Step 2 conditional rendering
  const [step1SellerType, setStep1SellerType] = useState<'individual' | 'business' | undefined>(
    initialData?.step1?.sellerType
  )

  const onSubmitStep1 = (data: Step1FormData) => {
    console.log('Step 1 data:', data)
    setStep1SellerType(data.sellerType)
    onStepComplete(1, data)
  }

  const toggleGame = (gameId: string) => {
    const current = selectedGames
    if (current.includes(gameId)) {
      setValue1('primaryGames', current.filter((id) => id !== gameId))
    } else {
      setValue1('primaryGames', [...current, gameId])
    }
  }

  // Step 2 Form
  const {
    register: register2,
    handleSubmit: handleSubmit2,
    formState: { errors: errors2 },
  } = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: initialData?.step2 || {},
  })

  const onSubmitStep2 = (data: Step2FormData) => {
    console.log('Step 2 data:', data)
    onStepComplete(2, data)
  }

  // Use step1SellerType or fallback to initialData
  const step2SellerType = step1SellerType || initialData?.step1?.sellerType

  return (
    <>
      {/* Step 1: Eligibility & Intent */}
      {currentStep === 1 && (
        <motion.div
          key="seller-step1"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit1(onSubmitStep1)} className="space-y-5 sm:space-y-6">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-5 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  Eligibility & Intent
                </h2>
                <p className="mt-1.5 text-xs text-text-secondary sm:text-sm">
                  Let's start with some basic information about you and your selling plans
                </p>
              </div>

              <div className="space-y-4 sm:space-y-5">
                {/* Seller Type */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                    Seller Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setValue1('sellerType', 'individual')}
                      className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all sm:p-4 ${
                        sellerType === 'individual'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                      }`}
                    >
                      <User
                        className={`mb-1.5 h-5 w-5 sm:mb-2 sm:h-6 sm:w-6 ${
                          sellerType === 'individual' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Individual</h3>
                      <p className="mt-0.5 text-[9px] text-text-secondary sm:text-[10px]">
                        Selling as an individual person
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue1('sellerType', 'business')}
                      className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all sm:p-4 ${
                        sellerType === 'business'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                      }`}
                    >
                      <Building2
                        className={`mb-1.5 h-5 w-5 sm:mb-2 sm:h-6 sm:w-6 ${
                          sellerType === 'business' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Business</h3>
                      <p className="mt-0.5 text-[9px] text-text-secondary sm:text-[10px]">
                        Registered company or business
                      </p>
                    </button>
                  </div>
                  {errors1.sellerType && (
                    <p className="mt-1.5 text-xs text-error">{errors1.sellerType.message}</p>
                  )}
                </div>

                {/* Age Verification */}
                <div>
                  <input type="hidden" {...register1('is18OrOlder')} />
                  <div className="flex items-start gap-3 sm:gap-3.5">
                    <button
                      type="button"
                      onClick={() => setValue1('is18OrOlder', !is18OrOlder)}
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 sm:h-6 sm:w-6 ${
                        is18OrOlder
                          ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                          : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                      }`}
                    >
                      {is18OrOlder && (
                        <Check className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" strokeWidth={3} />
                      )}
                    </button>
                    <div className="flex-1">
                      <button
                        type="button"
                        className="cursor-pointer select-none text-left"
                        onClick={() => setValue1('is18OrOlder', !is18OrOlder)}
                      >
                        <span className="text-sm font-medium text-white sm:text-base">
                          I am 18 years or older
                        </span>
                        <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                          You must be at least 18 years old to sell on GameVault
                        </p>
                      </button>
                    </div>
                  </div>
                  {errors1.is18OrOlder && (
                    <p className="mt-2 text-xs text-error sm:text-sm">
                      {errors1.is18OrOlder.message}
                    </p>
                  )}
                </div>

                {/* Primary Games */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                    Which games will you sell?
                    <span className="ml-1.5 text-[10px] font-normal text-text-secondary sm:text-xs">
                      (Select at least one)
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {GAMES.map((game) => {
                      const isSelected = selectedGames.includes(game.id)
                      return (
                        <button
                          key={game.id}
                          type="button"
                          onClick={() => toggleGame(game.id)}
                          className={`flex items-center gap-1.5 rounded-lg border p-2 text-left transition-all sm:gap-2 sm:p-2.5 ${
                            isSelected
                              ? 'border-primary border-2 bg-bg-overlay'
                              : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                          }`}
                        >
                          <div className="relative h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6">
                            <Image
                              src={game.image}
                              alt={game.name}
                              fill
                              className="object-contain"
                            />
                          </div>
                          <span
                            className={`text-[10px] font-medium sm:text-xs ${
                              isSelected ? 'text-white' : 'text-text-secondary'
                            }`}
                          >
                            {game.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {errors1.primaryGames && (
                    <p className="mt-1.5 text-xs text-error">{errors1.primaryGames.message}</p>
                  )}
                </div>

                {/* Expected Volume */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                    Expected Monthly Sales Volume
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { value: 'under_500', label: 'Under $500', desc: 'Just starting out' },
                      { value: '500_2000', label: '$500 - $2,000', desc: 'Growing seller' },
                      { value: '2000_10000', label: '$2,000 - $10,000', desc: 'Established' },
                      { value: 'over_10000', label: 'Over $10,000', desc: 'High volume' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setValue1('expectedVolume', option.value as any)}
                        className={`rounded-lg border p-2.5 text-left transition-all sm:p-3 ${
                          watch1('expectedVolume') === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-white/10 bg-bg-overlay hover:border-white/20 hover:bg-bg-overlay'
                        }`}
                      >
                        <h4 className="text-xs font-semibold text-white sm:text-sm">
                          {option.label}
                        </h4>
                        <p className="mt-0.5 text-[9px] text-text-secondary sm:text-[10px]">
                          {option.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                  {errors1.expectedVolume && (
                    <p className="mt-1.5 text-xs text-error">{errors1.expectedVolume.message}</p>
                  )}
                </div>

                {/* Referral Code */}
                <div>
                  <label
                    htmlFor="referralCode"
                    className="mb-1.5 block text-xs font-medium text-white sm:text-sm"
                  >
                    Referral Code{' '}
                    <span className="text-[10px] font-normal text-text-secondary sm:text-xs">
                      (Optional)
                    </span>
                  </label>
                  <input
                    {...register1('referralCode')}
                    id="referralCode"
                    type="text"
                    placeholder="Enter referral code if you have one"
                    className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-sm text-white placeholder-gray-500 transition-all focus:border-primary focus:bg-bg-overlay focus:outline-none sm:px-4 sm:py-2.5"
                  />
                </div>
              </div>
            </div>

            {/* Commission Tiers */}
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

            {/* Navigation */}
            <div className="flex justify-end">
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

      {/* Step 2: Business Information */}
      {currentStep === 2 && (
        <motion.div
          key="seller-step2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit2(onSubmitStep2)} className="space-y-5 sm:space-y-6">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-5 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  Business Information
                </h2>
                <p className="mt-1.5 text-xs text-text-secondary sm:text-sm">
                  {step2SellerType === 'business'
                    ? 'Tell us about your company and how we can reach you'
                    : 'Tell us about yourself and how we can reach you'}
                </p>
              </div>

              <div className="space-y-4 sm:space-y-5">
                {/* Full Legal Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                    Full Legal Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    {...register2('fullLegalName')}
                    placeholder="Enter your full legal name"
                    className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                  />
                  {errors2.fullLegalName && (
                    <p className="mt-1.5 text-xs text-error sm:text-sm">
                      {errors2.fullLegalName.message}
                    </p>
                  )}
                </div>

                {/* Display Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                    Display Name <span className="text-error">*</span>
                  </label>
                  <p className="mb-2 text-[10px] text-text-secondary sm:text-xs">
                    This is how your seller profile will appear to buyers
                  </p>
                  <input
                    type="text"
                    {...register2('displayName')}
                    placeholder="Choose a display name"
                    className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                  />
                  {errors2.displayName && (
                    <p className="mt-1.5 text-xs text-error sm:text-sm">
                      {errors2.displayName.message}
                    </p>
                  )}
                </div>

                {/* Shop Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                    Shop Name <span className="text-error">*</span>
                  </label>
                  <p className="mb-2 text-[10px] text-text-secondary sm:text-xs">
                    This will be used for your shop URL (e.g., /shop/your-shop-name)
                  </p>
                  <input
                    type="text"
                    {...register2('shopName')}
                    placeholder="Choose your shop name"
                    className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                  />
                  {errors2.shopName && (
                    <p className="mt-1.5 text-xs text-error sm:text-sm">
                      {errors2.shopName.message}
                    </p>
                  )}
                </div>

                {/* Location Section */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Location</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    {/* Country */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Country <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        {...register2('country')}
                        placeholder="e.g. United States"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors2.country && (
                        <p className="mt-1.5 text-xs text-error sm:text-sm">
                          {errors2.country.message}
                        </p>
                      )}
                    </div>

                    {/* State/Province */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        State/Province <span className="text-text-secondary">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        {...register2('stateProvince')}
                        placeholder="e.g. California"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                    </div>

                    {/* City */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        City <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        {...register2('city')}
                        placeholder="e.g. Los Angeles"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors2.city && (
                        <p className="mt-1.5 text-xs text-error sm:text-sm">
                          {errors2.city.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Section */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Contact Information</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    {/* Phone Number */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Phone Number <span className="text-error">*</span>
                      </label>
                      <input
                        type="tel"
                        {...register2('phoneNumber')}
                        placeholder="+1 (555) 000-0000"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors2.phoneNumber && (
                        <p className="mt-1.5 text-xs text-error sm:text-sm">
                          {errors2.phoneNumber.message}
                        </p>
                      )}
                    </div>

                    {/* Alternate Email */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Alternate Email <span className="text-text-secondary">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        {...register2('alternateEmail')}
                        placeholder="backup@example.com"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors2.alternateEmail && (
                        <p className="mt-1.5 text-xs text-error sm:text-sm">
                          {errors2.alternateEmail.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business-Specific Section */}
                {step2SellerType === 'business' && (
                  <div className="space-y-4 sm:space-y-5">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Business Details</h3>
                    </div>

                    {/* Company Legal Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Company Legal Name <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        {...register2('companyLegalName')}
                        placeholder="Enter registered company name"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                      {errors2.companyLegalName && (
                        <p className="mt-1.5 text-xs text-error sm:text-sm">
                          {errors2.companyLegalName.message}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                      {/* Business Registration Number */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Registration Number
                        </label>
                        <input
                          type="text"
                          {...register2('businessRegistrationNumber')}
                          placeholder="123456789"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>

                      {/* Tax ID/VAT */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Tax ID / VAT Number
                        </label>
                        <input
                          type="text"
                          {...register2('taxIdVat')}
                          placeholder="XX-XXXXXXX"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>
                    </div>

                    {/* Company Address */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Company Address
                      </label>
                      <input
                        type="text"
                        {...register2('companyAddress')}
                        placeholder="123 Business St, Suite 100"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                      {/* Business Type */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Type
                        </label>
                        <select
                          {...register2('businessType')}
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        >
                          <option value="" className="bg-black">Select type</option>
                          <option value="llc" className="bg-black">LLC</option>
                          <option value="corporation" className="bg-black">Corporation</option>
                          <option value="sole_proprietorship" className="bg-black">Sole Proprietorship</option>
                          <option value="partnership" className="bg-black">Partnership</option>
                          <option value="other" className="bg-black">Other</option>
                        </select>
                      </div>

                      {/* Year Established */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Year Established
                        </label>
                        <input
                          type="text"
                          {...register2('yearEstablished')}
                          placeholder="2020"
                          maxLength={4}
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                      {/* Business Email */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Email
                        </label>
                        <input
                          type="email"
                          {...register2('businessEmail')}
                          placeholder="contact@company.com"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                        {errors2.businessEmail && (
                          <p className="mt-1.5 text-xs text-error sm:text-sm">
                            {errors2.businessEmail.message}
                          </p>
                        )}
                      </div>

                      {/* Business Phone */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Phone
                        </label>
                        <input
                          type="tel"
                          {...register2('businessPhone')}
                          placeholder="+1 (555) 000-0000"
                          className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
    </>
  )
}
