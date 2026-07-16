/**
 * Seller Registration - Steps 5 & 6
 *
 * Step 5: Payout
 * - Rails match the real payout system: Bank Transfer (fiat) and Crypto,
 *   with fees and the minimum payout rendered from @/lib/fees
 * - Tax information and residency
 *
 * Step 6: Final Review & Agreements
 * - Human-readable summary of everything entered, grouped by step,
 *   with Edit shortcuts back to each step
 * - Model C Seller Agency Agreement acknowledgment + fee schedule,
 *   privacy, anti-fraud, data-processing and accuracy confirmations
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronRight,
  ChevronLeft,
  Landmark,
  Bitcoin,
  Check,
  Rocket,
  Loader2,
  Pencil,
  ArrowUpRight,
  FileCheck2,
} from 'lucide-react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

import {
  step5Schema,
  step6Schema,
  type Step1FormData,
  type Step2FormData,
  type Step4FormData,
  type Step5FormData,
  type Step6FormData,
  type UploadedDoc,
} from '../schemas'
import type { UploadedDocsState, WizardGame } from '../types'
import { OTHER_COUNTRY, COUNTRIES } from '../data/countries'
import { Combobox } from '@/components/ui/combobox'
import FeeSummaryCard from './shared/FeeSummaryCard'
import { PAYOUT_FEES, PAYOUT_MIN_USD } from '@/lib/fees'
import {
  VOLUME_LABELS,
  PAYOUT_METHOD_LABELS,
  SELLER_TYPE_LABELS,
  TAX_FORM_LABELS,
  CRYPTO_TYPE_LABELS,
  label,
} from '@/lib/seller-application/labels'

const inputClass =
  'w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-sm'

const TAX_COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.name, label: c.name, keywords: [c.iso2] }))

const KYC_DOC_LABELS: Array<{ key: keyof UploadedDocsState; label: string; required?: boolean }> = [
  { key: 'idDocument', label: 'Government ID', required: true },
  { key: 'selfieWithId', label: 'Selfie With ID', required: true },
  { key: 'proofOfAddress', label: 'Proof Of Address', required: true },
  { key: 'certificateOfIncorporation', label: 'Certificate Of Incorporation' },
  { key: 'businessLicense', label: 'Business License' },
  { key: 'directorId', label: 'Director/Owner ID' },
  { key: 'bankStatement', label: 'Bank Statement' },
]

interface SellerSteps56Props {
  currentStep: number
  onStepComplete: (step: number, data: Step5FormData | Step6FormData) => void
  onStepBack?: () => void
  onSubmitApplication?: (step6Data: Step6FormData) => void
  isSubmitting?: boolean
  /** Jump straight to a step from the review summary. */
  goToStep?: (step: number) => void
  games: WizardGame[]
  uploadedDocs: UploadedDocsState
  storeImage: UploadedDoc | null
  reviewData?: {
    step1?: Step1FormData
    step2?: Step2FormData
    step4?: Step4FormData
    step5?: Step5FormData
  }
  initialData?: {
    step5?: Partial<Step5FormData>
    step6?: Partial<Step6FormData>
  }
}

/** One row in the final-review summary. */
function ReviewRow({ label: rowLabel, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs sm:text-sm">
      <span className="flex-shrink-0 text-text-tertiary">{rowLabel}</span>
      <span className="text-right text-text-secondary">{value}</span>
    </div>
  )
}

function ReviewGroup({
  title,
  step,
  goToStep,
  children,
}: {
  title: string
  step: number
  goToStep?: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-overlay p-3 sm:p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-white sm:text-sm">{title}</h4>
        {goToStep && (
          <button
            type="button"
            onClick={() => goToStep(step)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-white sm:text-xs"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  )
}

export default function SellerSteps56({
  currentStep,
  onStepComplete,
  onStepBack,
  onSubmitApplication,
  isSubmitting = false,
  goToStep,
  games,
  uploadedDocs,
  storeImage,
  reviewData,
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
    defaultValues: {
      taxResidencyCountry: '',
      taxForm: 'none',
      ...(initialData?.step5 || {}),
    },
  })

  const payoutMethod = watch5('payoutMethod')

  const onSubmitStep5 = (data: Step5FormData) => {
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
    onStepComplete(6, data)
    if (onSubmitApplication) {
      // Pass step6 data directly to avoid race condition with state updates
      onSubmitApplication(data)
    }
  }

  // ── Review helpers ─────────────────────────────────────────────────────────
  const step1 = reviewData?.step1
  const step2 = reviewData?.step2
  const step4 = reviewData?.step4
  const step5 = reviewData?.step5

  const gameNames = (step1?.primaryGames || []).map(
    (id) => games.find((g) => g.id === id)?.name ?? id
  )
  const reviewCountry =
    step2?.country === OTHER_COUNTRY ? step2?.countryOther || 'Other' : step2?.country
  const reviewPhone = step2?.phoneNumber
    ? parsePhoneNumberFromString(step2.phoneNumber)?.formatInternational() ?? step2.phoneNumber
    : undefined
  const storeImageUrl = storeImage?.path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-pictures/${storeImage.path}`
    : null
  const payoutRail = step5?.payoutMethod === 'crypto' ? PAYOUT_FEES.crypto : PAYOUT_FEES.fiat

  return (
    <>
      {/* Step 5: Payout */}
      {currentStep === 5 && (
        <motion.div
          key="seller-step5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit5(onSubmitStep5)} className="space-y-4 sm:space-y-5">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center sm:mb-5">
                <h2 className="text-lg font-semibold text-white sm:text-xl">Payout</h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  Choose how you&apos;ll receive your earnings
                </p>
              </div>

              <div className="space-y-4">
                {/* Payout Method Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Payout Method</h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setValue5('payoutMethod', 'bank_transfer', { shouldValidate: true })}
                      className={`rounded-lg border p-4 text-left transition-all ${
                        payoutMethod === 'bank_transfer'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20'
                      }`}
                    >
                      <Landmark
                        className={`mb-2 h-5 w-5 ${
                          payoutMethod === 'bank_transfer' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h4 className="text-sm font-semibold text-white">Bank Transfer</h4>
                      <p className="mt-0.5 text-xs text-text-secondary">ACH / wire to your bank account</p>
                      <p className="mt-1.5 text-xs font-medium tabular-nums text-lime-text">
                        {PAYOUT_FEES.fiat.pct}% + ${PAYOUT_FEES.fiat.fixed} per payout
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValue5('payoutMethod', 'crypto', { shouldValidate: true })}
                      className={`rounded-lg border p-4 text-left transition-all ${
                        payoutMethod === 'crypto'
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-bg-overlay hover:border-white/20'
                      }`}
                    >
                      <Bitcoin
                        className={`mb-2 h-5 w-5 ${
                          payoutMethod === 'crypto' ? 'text-primary' : 'text-text-secondary'
                        }`}
                      />
                      <h4 className="text-sm font-semibold text-white">Crypto</h4>
                      <p className="mt-0.5 text-xs text-text-secondary">BTC, ETH or USDT wallet</p>
                      <p className="mt-1.5 text-xs font-medium tabular-nums text-lime-text">
                        {PAYOUT_FEES.crypto.pct}% + ${PAYOUT_FEES.crypto.fixed} per payout
                      </p>
                    </button>
                  </div>
                  <input type="hidden" {...register5('payoutMethod')} />
                  {errors5.payoutMethod && (
                    <p className="text-xs text-error">{errors5.payoutMethod.message}</p>
                  )}

                  <p className="text-[10px] text-text-tertiary sm:text-xs">
                    Minimum payout ${PAYOUT_MIN_USD}.{' '}
                    <Link href="/fees" target="_blank" className="text-text-secondary underline underline-offset-2 hover:text-white">
                      See the full fee schedule
                    </Link>
                  </p>
                </div>

                {/* Bank Transfer Fields */}
                {payoutMethod === 'bank_transfer' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Bank Account Details</h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Account Holder Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('accountHolderName')}
                          placeholder="Full name on account"
                          className={inputClass}
                        />
                        {errors5.accountHolderName && (
                          <p className="mt-1.5 text-xs text-error">{errors5.accountHolderName.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Bank Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('bankName')}
                          placeholder="e.g., Chase Bank"
                          className={inputClass}
                        />
                        {errors5.bankName && (
                          <p className="mt-1.5 text-xs text-error">{errors5.bankName.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Account Number <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('accountNumber')}
                          placeholder="Account number"
                          className={inputClass}
                        />
                        {errors5.accountNumber && (
                          <p className="mt-1.5 text-xs text-error">{errors5.accountNumber.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">Routing Code</label>
                        <input
                          type="text"
                          {...register5('routingCode')}
                          placeholder="9-digit routing number"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          SWIFT Code <span className="font-normal text-text-secondary">(International)</span>
                        </label>
                        <input
                          type="text"
                          {...register5('swiftCode')}
                          placeholder="SWIFT/BIC code"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          IBAN <span className="font-normal text-text-secondary">(International)</span>
                        </label>
                        <input
                          type="text"
                          {...register5('iban')}
                          placeholder="International bank account number"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Crypto Fields */}
                {payoutMethod === 'crypto' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Crypto Details</h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Cryptocurrency <span className="text-error">*</span>
                        </label>
                        <select {...register5('cryptoType')} className={inputClass}>
                          <option value="" className="bg-black">Select cryptocurrency</option>
                          <option value="BTC" className="bg-black">Bitcoin (BTC)</option>
                          <option value="ETH" className="bg-black">Ethereum (ETH)</option>
                          <option value="USDT" className="bg-black">Tether (USDT)</option>
                        </select>
                        {errors5.cryptoType && (
                          <p className="mt-1.5 text-xs text-error">{errors5.cryptoType.message}</p>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                          Wallet Address <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          {...register5('cryptoWalletAddress')}
                          placeholder="Your cryptocurrency wallet address"
                          className={inputClass}
                        />
                        {errors5.cryptoWalletAddress && (
                          <p className="mt-1.5 text-xs text-error">{errors5.cryptoWalletAddress.message}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tax Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Tax Information</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Tax Residency Country <span className="text-error">*</span>
                      </label>
                      <Combobox
                        value={watch5('taxResidencyCountry') || ''}
                        onChange={(v) => setValue5('taxResidencyCountry', v, { shouldValidate: true })}
                        options={TAX_COUNTRY_OPTIONS}
                        placeholder="Select country"
                        ariaLabel="Tax residency country"
                        invalid={!!errors5.taxResidencyCountry}
                      />
                      {errors5.taxResidencyCountry && (
                        <p className="mt-1.5 text-xs text-error">{errors5.taxResidencyCountry.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Tax Form <span className="font-normal text-text-secondary">(If applicable)</span>
                      </label>
                      <select {...register5('taxForm')} className={inputClass}>
                        <option value="none" className="bg-black">Not applicable</option>
                        <option value="w9" className="bg-black">W-9 (US sellers)</option>
                        <option value="w8ben" className="bg-black">W-8BEN (International sellers)</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
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

      {/* Step 6: Final Review & Agreements */}
      {currentStep === 6 && (
        <motion.div
          key="seller-step6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit6(onSubmitStep6)} className="space-y-4 sm:space-y-5">
            {/* Final Review */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold text-white sm:text-xl">Final Review</h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  Double-check everything before you submit — use Edit to jump back to any step
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Eligibility & Games */}
                <ReviewGroup title="Selling Plans" step={1} goToStep={goToStep}>
                  <ReviewRow label="Seller Type" value={label(SELLER_TYPE_LABELS, step1?.sellerType)} />
                  <ReviewRow label="Monthly Volume" value={label(VOLUME_LABELS, step1?.expectedVolume)} />
                  <ReviewRow
                    label="Games"
                    value={
                      gameNames.length > 0 || step1?.otherGames ? (
                        <span>
                          {gameNames.join(', ')}
                          {step1?.otherGames?.trim() && (
                            <span>{gameNames.length > 0 ? ', ' : ''}{step1.otherGames.trim()}</span>
                          )}
                        </span>
                      ) : (
                        'None selected'
                      )
                    }
                  />
                  {step1?.referralCode?.trim() && (
                    <ReviewRow label="Referral Code" value={step1.referralCode} />
                  )}
                </ReviewGroup>

                {/* Identity */}
                <ReviewGroup title="Identity & Contact" step={2} goToStep={goToStep}>
                  <ReviewRow label="Legal Name" value={step2?.fullLegalName} />
                  <ReviewRow label="Display Name" value={step2?.displayName} />
                  <ReviewRow label="Shop Name" value={step2?.shopName} />
                  <ReviewRow
                    label="Location"
                    value={[step2?.city, step2?.stateProvince, reviewCountry].filter(Boolean).join(', ')}
                  />
                  <ReviewRow label="Phone" value={reviewPhone} />
                  {step2?.alternateEmail && <ReviewRow label="Alternate Email" value={step2.alternateEmail} />}
                </ReviewGroup>

                {/* Documents */}
                <ReviewGroup title="Verification Documents" step={3} goToStep={goToStep}>
                  {KYC_DOC_LABELS.filter((d) => d.required || uploadedDocs[d.key]).map((d) => {
                    const doc = uploadedDocs[d.key]
                    return (
                      <div key={d.key} className="flex items-center justify-between gap-3 py-1 text-xs sm:text-sm">
                        <span className="text-text-tertiary">{d.label}</span>
                        {doc ? (
                          <span className="inline-flex items-center gap-1 text-lime-text">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-error">Missing</span>
                        )}
                      </div>
                    )
                  })}
                </ReviewGroup>

                {/* Profile */}
                <ReviewGroup title="Seller Profile" step={4} goToStep={goToStep}>
                  <div className="flex items-center justify-between gap-3 py-1 text-xs sm:text-sm">
                    <span className="text-text-tertiary">Store Image</span>
                    {storeImageUrl ? (
                      <span className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={storeImageUrl}
                          alt="Store"
                          className="h-8 w-8 rounded-full border border-border-subtle object-cover"
                        />
                        <span className="inline-flex items-center gap-1 text-lime-text">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-text-secondary">Not added</span>
                    )}
                  </div>
                  <ReviewRow label="Bio" value={step4?.bio?.trim() ? 'Added' : 'Not added'} />
                  {step4?.businessHours && <ReviewRow label="Availability" value={step4.businessHours} />}
                </ReviewGroup>

                {/* Payout */}
                <ReviewGroup title="Payout" step={5} goToStep={goToStep}>
                  <ReviewRow
                    label="Method"
                    value={
                      step5?.payoutMethod ? (
                        <span>
                          {label(PAYOUT_METHOD_LABELS, step5.payoutMethod)}{' '}
                          <span className="tabular-nums text-text-tertiary">
                            ({payoutRail.pct}% + ${payoutRail.fixed}, ${PAYOUT_MIN_USD} min)
                          </span>
                        </span>
                      ) : undefined
                    }
                  />
                  {step5?.payoutMethod === 'bank_transfer' && (
                    <>
                      <ReviewRow label="Bank" value={step5?.bankName} />
                      <ReviewRow label="Account Holder" value={step5?.accountHolderName} />
                    </>
                  )}
                  {step5?.payoutMethod === 'crypto' && (
                    <ReviewRow label="Coin" value={label(CRYPTO_TYPE_LABELS, step5?.cryptoType)} />
                  )}
                  <ReviewRow label="Tax Residency" value={step5?.taxResidencyCountry} />
                  {step5?.taxForm && step5.taxForm !== 'none' && (
                    <ReviewRow label="Tax Form" value={label(TAX_FORM_LABELS, step5.taxForm)} />
                  )}
                </ReviewGroup>

                {/* Fees recap */}
                <FeeSummaryCard />
              </div>
            </div>

            {/* Agreements Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold text-white sm:text-xl">Agreements</h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  Please review and accept all agreements to complete your application
                </p>
              </div>

              <div className="space-y-4">
                {/* Agreements Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Required Agreements</h3>
                  </div>

                  {[
                    {
                      name: 'acceptedSellerAgreement',
                      label: 'Seller Agency Agreement',
                      href: '/seller-agreement',
                      desc: 'I appoint DropMarket as my disclosed commercial agent to conclude sales on my behalf, and I have read and agree to the Seller Agency Agreement',
                    },
                    {
                      name: 'acceptedFeeSchedule',
                      label: 'Fee Schedule',
                      href: '/fees',
                      desc: 'I understand and accept the per-category commission and payout fees',
                    },
                    {
                      name: 'acceptedPrivacyPolicy',
                      label: 'Privacy Policy',
                      href: '/privacy',
                      desc: 'I have read and agree to the Privacy Policy',
                    },
                    {
                      name: 'acceptedAntiFraudPolicy',
                      label: 'Anti-Fraud Policy',
                      href: '/trust-safety',
                      desc: 'I agree to comply with the Anti-Fraud Policy',
                    },
                    {
                      name: 'acceptedDataProcessing',
                      label: 'Data Processing Agreement',
                      href: '/privacy',
                      desc: 'I consent to data processing as per GDPR compliance',
                    },
                  ].map((agreement) => {
                    const fieldName = agreement.name as keyof Step6FormData
                    const isChecked = watch6(fieldName)
                    return (
                      <div key={agreement.name}>
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setValue6(fieldName, !isChecked, { shouldValidate: true })}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                              isChecked
                                ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                                : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                            }`}
                          >
                            {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                          </button>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-x-2">
                              <button
                                type="button"
                                className="cursor-pointer select-none text-left text-xs font-medium text-white sm:text-sm"
                                onClick={() => setValue6(fieldName, !isChecked, { shouldValidate: true })}
                              >
                                {agreement.label}
                              </button>
                              <Link
                                href={agreement.href}
                                target="_blank"
                                className="inline-flex items-center gap-0.5 text-[10px] text-text-secondary underline underline-offset-2 hover:text-white sm:text-xs"
                              >
                                Read
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </div>
                            <p className="mt-0.5 text-[10px] text-text-secondary sm:text-xs">{agreement.desc}</p>
                          </div>
                        </div>
                        <input type="hidden" {...register6(fieldName)} />
                        {errors6[fieldName] && (
                          <p className="ml-8 mt-1 text-xs text-error">{errors6[fieldName]?.message}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Final Confirmations */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Final Confirmations</h3>
                  </div>

                  {[
                    {
                      name: 'informationAccurate',
                      label: 'Information Accuracy',
                      desc: 'I confirm that all information provided is accurate and truthful',
                    },
                    {
                      name: 'understandConsequences',
                      label: 'Understanding Of Consequences',
                      desc: 'I understand that providing false information may result in permanent ban',
                    },
                  ].map((confirmation) => {
                    const fieldName = confirmation.name as keyof Step6FormData
                    const isChecked = watch6(fieldName)
                    return (
                      <div key={confirmation.name}>
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setValue6(fieldName, !isChecked, { shouldValidate: true })}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                              isChecked
                                ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                                : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                            }`}
                          >
                            {isChecked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                          </button>
                          <div className="flex-1">
                            <button
                              type="button"
                              className="cursor-pointer select-none text-left"
                              onClick={() => setValue6(fieldName, !isChecked, { shouldValidate: true })}
                            >
                              <span className="text-xs font-medium text-white sm:text-sm">{confirmation.label}</span>
                              <p className="mt-0.5 text-[10px] text-text-secondary sm:text-xs">{confirmation.desc}</p>
                            </button>
                          </div>
                        </div>
                        <input type="hidden" {...register6(fieldName)} />
                        {errors6[fieldName] && (
                          <p className="ml-8 mt-1 text-xs text-error">{errors6[fieldName]?.message}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Important Notice */}
                <div className="flex items-start gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                  <FileCheck2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-200" />
                  <p className="text-xs text-yellow-200 sm:text-sm">
                    <span className="font-semibold">Important:</span> By submitting, you acknowledge your
                    application will be reviewed by our team. You&apos;ll receive a confirmation email within
                    24-48 hours.
                  </p>
                </div>
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
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-lime px-5 py-2 text-xs font-semibold text-black transition-all hover:bg-lime/90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    Submitting…
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </>
                ) : (
                  <>
                    Submit Application
                    <Rocket className="h-3.5 w-3.5" />
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
