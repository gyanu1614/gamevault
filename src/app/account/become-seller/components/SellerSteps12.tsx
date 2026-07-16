/**
 * Seller Registration - Steps 1 & 2
 *
 * Step 1: Eligibility & Intent
 * - Age verification (18+), seller type
 * - Games (searchable multi-select from the DB catalog + Other free text)
 * - Expected monthly volume, referral code
 * - Read-only per-category fee summary (from @/lib/fees)
 *
 * Step 2: Identity & Contact
 * - Personal/company details
 * - Country/region from the full dataset (+ Other), international phone input
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronRight, ChevronLeft, User, Building2 } from 'lucide-react'

import { step1Schema, step2Schema, type Step1FormData, type Step2FormData } from '../schemas'
import type { WizardGame } from '../types'
import { COUNTRIES, OTHER_COUNTRY, findCountryByName } from '../data/countries'
import { Combobox } from '@/components/ui/combobox'
import GameMultiSelect from './shared/GameMultiSelect'
import PhoneInput from './shared/PhoneInput'
import FeeSummaryCard from './shared/FeeSummaryCard'

const COUNTRY_OPTIONS = [
  ...COUNTRIES.map((c) => ({ value: c.name, label: c.name, keywords: [c.iso2] })),
  { value: OTHER_COUNTRY, label: 'Other (Not Listed)', keywords: ['other'] },
]

const inputClass =
  'w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-sm'

interface SellerSteps12Props {
  currentStep: number
  games: WizardGame[]
  onStepComplete: (step: number, data: Step1FormData | Step2FormData) => void
  onStepBack?: () => void
  initialData?: {
    step1?: Partial<Step1FormData>
    step2?: Partial<Step2FormData>
  }
}

export default function SellerSteps12({
  currentStep,
  games,
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
      otherGames: initialData?.step1?.otherGames || '',
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
    setStep1SellerType(data.sellerType)
    onStepComplete(1, data)
  }

  // Step 2 Form
  const {
    register: register2,
    handleSubmit: handleSubmit2,
    formState: { errors: errors2 },
    watch: watch2,
    setValue: setValue2,
  } = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      country: '',
      countryOther: '',
      stateProvince: '',
      phoneNumber: '',
      ...(initialData?.step2 || {}),
    },
  })

  const country = watch2('country')
  const regions = findCountryByName(country)?.regions ?? []

  const onSubmitStep2 = (data: Step2FormData) => {
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
          <form onSubmit={handleSubmit1(onSubmitStep1)} className="space-y-4 sm:space-y-5">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center sm:mb-5">
                <h2 className="text-lg font-semibold text-white sm:text-xl">Eligibility & Intent</h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  Let&apos;s start with some basic information about you and your selling plans
                </p>
              </div>

              <div className="space-y-4">
                {/* Seller Type */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                    Seller Type <span className="text-error">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setValue1('sellerType', 'individual', { shouldValidate: true })}
                      className={`group relative overflow-hidden rounded-lg border p-3 text-left transition-all ${
                        sellerType === 'individual'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20'
                      }`}
                    >
                      <User
                        className={`mb-1.5 h-5 w-5 ${
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
                      onClick={() => setValue1('sellerType', 'business', { shouldValidate: true })}
                      className={`group relative overflow-hidden rounded-lg border p-3 text-left transition-all ${
                        sellerType === 'business'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20'
                      }`}
                    >
                      <Building2
                        className={`mb-1.5 h-5 w-5 ${
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
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setValue1('is18OrOlder', !is18OrOlder, { shouldValidate: true })}
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                        is18OrOlder
                          ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                          : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                      }`}
                    >
                      {is18OrOlder && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </button>
                    <button
                      type="button"
                      className="flex-1 cursor-pointer select-none text-left"
                      onClick={() => setValue1('is18OrOlder', !is18OrOlder, { shouldValidate: true })}
                    >
                      <span className="text-xs font-medium text-white sm:text-sm">
                        I am 18 years or older <span className="text-error">*</span>
                      </span>
                      <p className="mt-0.5 text-[10px] text-text-secondary sm:text-xs">
                        You must be at least 18 years old to sell on DropMarket
                      </p>
                    </button>
                  </div>
                  {errors1.is18OrOlder && (
                    <p className="mt-1.5 text-xs text-error">{errors1.is18OrOlder.message}</p>
                  )}
                </div>

                {/* Primary Games — searchable multi-select from DB */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                    Which Games Will You Sell? <span className="text-error">*</span>
                  </label>
                  <GameMultiSelect
                    games={games}
                    selected={selectedGames}
                    onChange={(ids) => setValue1('primaryGames', ids, { shouldValidate: true })}
                    invalid={!!errors1.primaryGames}
                  />
                  {errors1.primaryGames && (
                    <p className="mt-1.5 text-xs text-error">{errors1.primaryGames.message}</p>
                  )}

                  {/* Other games — free text */}
                  <div className="mt-2">
                    <label htmlFor="otherGames" className="mb-1 block text-[10px] font-medium text-text-secondary sm:text-xs">
                      Other Games Not Listed{' '}
                      <span className="font-normal text-text-tertiary">(Optional, comma separated)</span>
                    </label>
                    <input
                      {...register1('otherGames')}
                      id="otherGames"
                      type="text"
                      placeholder="e.g. Palworld, Escape From Tarkov"
                      className={inputClass}
                    />
                    {errors1.otherGames && (
                      <p className="mt-1 text-xs text-error">{errors1.otherGames.message}</p>
                    )}
                  </div>
                </div>

                {/* Expected Volume */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                    Expected Monthly Sales Volume <span className="text-error">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { value: 'under_500', label: 'Under $500', desc: 'Just starting out' },
                      { value: '500_2000', label: '$500 - $2,000', desc: 'Growing seller' },
                      { value: '2000_10000', label: '$2,000 - $10,000', desc: 'Established' },
                      { value: 'over_10000', label: 'Over $10,000', desc: 'High volume' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setValue1('expectedVolume', option.value as Step1FormData['expectedVolume'], {
                            shouldValidate: true,
                          })
                        }
                        className={`rounded-lg border p-2.5 text-left transition-all ${
                          watch1('expectedVolume') === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-white/10 bg-bg-overlay hover:border-white/20'
                        }`}
                      >
                        <h4 className="text-xs font-semibold text-white">{option.label}</h4>
                        <p className="mt-0.5 text-[9px] text-text-secondary sm:text-[10px]">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                  {errors1.expectedVolume && (
                    <p className="mt-1.5 text-xs text-error">{errors1.expectedVolume.message}</p>
                  )}
                </div>

                {/* Referral Code */}
                <div>
                  <label htmlFor="referralCode" className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                    Referral Code{' '}
                    <span className="text-[10px] font-normal text-text-secondary sm:text-xs">(Optional)</span>
                  </label>
                  <input
                    {...register1('referralCode')}
                    id="referralCode"
                    type="text"
                    placeholder="Enter referral code if you have one"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Per-category fee summary (replaces commission tiers) */}
            <FeeSummaryCard compact />

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

      {/* Step 2: Identity & Contact */}
      {currentStep === 2 && (
        <motion.div
          key="seller-step2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit2(onSubmitStep2)} className="space-y-4 sm:space-y-5">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center sm:mb-5">
                <h2 className="text-lg font-semibold text-white sm:text-xl">
                  {step2SellerType === 'business' ? 'Business Information' : 'Your Information'}
                </h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  {step2SellerType === 'business'
                    ? 'Tell us about your company and how we can reach you'
                    : 'Tell us about yourself and how we can reach you'}
                </p>
              </div>

              <div className="space-y-4">
                {/* Identity */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Full Legal Name */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Full Legal Name <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      {...register2('fullLegalName')}
                      placeholder="Enter your full legal name"
                      className={inputClass}
                    />
                    {errors2.fullLegalName && (
                      <p className="mt-1.5 text-xs text-error">{errors2.fullLegalName.message}</p>
                    )}
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Display Name <span className="text-error">*</span>
                    </label>
                    <p className="mb-1.5 text-[10px] text-text-secondary sm:text-xs">
                      How your seller profile appears to buyers
                    </p>
                    <input
                      type="text"
                      {...register2('displayName')}
                      placeholder="Choose a display name"
                      className={inputClass}
                    />
                    {errors2.displayName && (
                      <p className="mt-1.5 text-xs text-error">{errors2.displayName.message}</p>
                    )}
                  </div>

                  {/* Shop Name */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Shop Name <span className="text-error">*</span>
                    </label>
                    <p className="mb-1.5 text-[10px] text-text-secondary sm:text-xs">
                      Used for your shop URL (e.g. /shop/your-shop-name)
                    </p>
                    <input
                      type="text"
                      {...register2('shopName')}
                      placeholder="Choose your shop name"
                      className={inputClass}
                    />
                    {errors2.shopName && (
                      <p className="mt-1.5 text-xs text-error">{errors2.shopName.message}</p>
                    )}
                  </div>
                </div>

                {/* Location Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Location</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Country */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Country <span className="text-error">*</span>
                      </label>
                      <Combobox
                        value={country || ''}
                        onChange={(v) => {
                          setValue2('country', v, { shouldValidate: true })
                          setValue2('stateProvince', '')
                          if (v !== OTHER_COUNTRY) setValue2('countryOther', '')
                        }}
                        options={COUNTRY_OPTIONS}
                        placeholder="Select your country"
                        ariaLabel="Country"
                        invalid={!!errors2.country}
                      />
                      {errors2.country && (
                        <p className="mt-1.5 text-xs text-error">{errors2.country.message}</p>
                      )}
                    </div>

                    {/* Other country free text */}
                    {country === OTHER_COUNTRY && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Country Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register2('countryOther')}
                          placeholder="Enter your country"
                          className={inputClass}
                        />
                        {errors2.countryOther && (
                          <p className="mt-1.5 text-xs text-error">{errors2.countryOther.message}</p>
                        )}
                      </div>
                    )}

                    {/* State/Province */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        State/Province <span className="font-normal text-text-secondary">(Optional)</span>
                      </label>
                      {regions.length > 0 ? (
                        <Combobox
                          value={watch2('stateProvince') || ''}
                          onChange={(v) => setValue2('stateProvince', v)}
                          options={regions.map((r) => ({ value: r, label: r }))}
                          placeholder="Select state or province"
                          ariaLabel="State or province"
                        />
                      ) : (
                        <input
                          type="text"
                          {...register2('stateProvince')}
                          placeholder="e.g. Bavaria"
                          className={inputClass}
                        />
                      )}
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
                        className={inputClass}
                      />
                      {errors2.city && (
                        <p className="mt-1.5 text-xs text-error">{errors2.city.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Contact Information</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Phone Number */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Phone Number <span className="text-error">*</span>
                      </label>
                      <PhoneInput
                        value={watch2('phoneNumber') || ''}
                        onChange={(v) => setValue2('phoneNumber', v, { shouldValidate: !!errors2.phoneNumber })}
                        defaultCountryName={country !== OTHER_COUNTRY ? country : undefined}
                        invalid={!!errors2.phoneNumber}
                      />
                      {errors2.phoneNumber && (
                        <p className="mt-1.5 text-xs text-error">{errors2.phoneNumber.message}</p>
                      )}
                    </div>

                    {/* Alternate Email */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Alternate Email <span className="font-normal text-text-secondary">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        {...register2('alternateEmail')}
                        placeholder="backup@example.com"
                        className={inputClass}
                      />
                      {errors2.alternateEmail && (
                        <p className="mt-1.5 text-xs text-error">{errors2.alternateEmail.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business-Specific Section */}
                {step2SellerType === 'business' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Business Details</h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Company Legal Name */}
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Company Legal Name <span className="font-normal text-text-secondary">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          {...register2('companyLegalName')}
                          placeholder="Enter registered company name"
                          className={inputClass}
                        />
                      </div>

                      {/* Business Registration Number */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Registration Number
                        </label>
                        <input
                          type="text"
                          {...register2('businessRegistrationNumber')}
                          placeholder="123456789"
                          className={inputClass}
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
                          className={inputClass}
                        />
                      </div>

                      {/* Company Address */}
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Company Address
                        </label>
                        <input
                          type="text"
                          {...register2('companyAddress')}
                          placeholder="123 Business St, Suite 100"
                          className={inputClass}
                        />
                      </div>

                      {/* Business Type */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Type
                        </label>
                        <select {...register2('businessType')} className={inputClass}>
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
                          className={inputClass}
                        />
                      </div>

                      {/* Business Email */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Business Email
                        </label>
                        <input
                          type="email"
                          {...register2('businessEmail')}
                          placeholder="contact@company.com"
                          className={inputClass}
                        />
                        {errors2.businessEmail && (
                          <p className="mt-1.5 text-xs text-error">{errors2.businessEmail.message}</p>
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
                          placeholder="+1 555 000 0000"
                          className={inputClass}
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
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-xs font-medium text-white transition-all hover:bg-white/10 sm:gap-1.5 sm:px-4 sm:text-sm"
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
