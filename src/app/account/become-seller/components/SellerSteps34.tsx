/**
 * Seller Registration - Steps 3 & 4
 *
 * Step 3: Identity Verification (KYC)
 * - Documents upload IMMEDIATELY on pick (progress + preview + uploaded state)
 * - Continue is blocked until every required document has actually uploaded
 *
 * Step 4: Seller Profile Setup
 * - Store Image (shown on your shop and profile right away, even before
 *   the application is approved)
 * - Bio, availability, languages, socials, store policies
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, ChevronLeft } from 'lucide-react'

import { step3Schema, step4Schema, type Step3FormData, type Step4FormData, type UploadedDoc } from '../schemas'
import type { KycDocKey, UploadedDocsState } from '../types'
import { LANGUAGES } from '../constants'
import { createClient } from '@/lib/supabase/client'
import FileUploadBox from './shared/FileUploadBox'

const inputClass =
  'w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-2.5 sm:text-sm'

interface SellerSteps34Props {
  currentStep: number
  onStepComplete: (step: number, data: Step3FormData | Step4FormData) => void
  onStepBack?: () => void
  initialData?: {
    step3?: Partial<Step3FormData>
    step4?: Partial<Step4FormData>
  }
  // Immediately-uploaded documents (owned by the orchestrator)
  uploadedDocs: UploadedDocsState
  onDocChange: (fileType: string, doc: UploadedDoc | null) => void
  storeImage: UploadedDoc | null
  onStoreImageChange: (doc: UploadedDoc | null) => void
  selectedLanguages: string[]
  onLanguagesChange: (languages: string[]) => void
  sellerType?: 'individual' | 'business'
}

export default function SellerSteps34({
  currentStep,
  onStepComplete,
  onStepBack,
  initialData,
  uploadedDocs,
  onDocChange,
  storeImage,
  onStoreImageChange,
  selectedLanguages,
  onLanguagesChange,
  sellerType,
}: SellerSteps34Props) {
  // Step 3 has no free-form inputs — validation runs against the actually
  // uploaded documents, so a required doc can never pass on a local pick.
  const [step3Errors, setStep3Errors] = useState<Partial<Record<KycDocKey, string>>>({})

  const onSubmitStep3 = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = step3Schema.safeParse(uploadedDocs)
    if (!parsed.success) {
      const errs: Partial<Record<KycDocKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as KycDocKey
        if (key && !errs[key]) errs[key] = issue.message
      }
      setStep3Errors(errs)
      return
    }
    setStep3Errors({})
    onStepComplete(3, parsed.data)
  }

  const handleDocChange = (fileType: string, doc: UploadedDoc | null) => {
    setStep3Errors((prev) => ({ ...prev, [fileType]: undefined }))
    onDocChange(fileType, doc)
  }

  // Step 4 Form
  const {
    register: register4,
    handleSubmit: handleSubmit4,
    formState: { errors: errors4 },
    watch: watch4,
    setValue: setValue4,
  } = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    defaultValues: initialData?.step4 || {},
  })

  const bio = watch4('bio') || ''

  const onSubmitStep4 = (data: Step4FormData) => {
    onStepComplete(4, { ...data, storeImage })
  }

  /**
   * Store Image uploads immediately; as soon as it lands we point
   * profiles.avatar_url at it so the shop page and account UI show it
   * right away — no waiting for application approval.
   */
  const handleStoreImageChange = async (_fileType: string, doc: UploadedDoc | null) => {
    onStoreImageChange(doc)
    if (!doc) return
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: publicUrlData } = supabase.storage.from('profile-pictures').getPublicUrl(doc.path)
      if (publicUrlData?.publicUrl) {
        await (supabase.from('profiles').update as any)({ avatar_url: publicUrlData.publicUrl }).eq('id', user.id)
      }
    } catch (err) {
      // Non-fatal — the path still submits with the application
      console.error('[SellerSteps34] Failed to sync store image to profile:', err)
    }
  }

  const toggleLanguage = (lang: string) => {
    if (selectedLanguages.includes(lang)) {
      onLanguagesChange(selectedLanguages.filter((l) => l !== lang))
    } else {
      onLanguagesChange([...selectedLanguages, lang])
    }
  }

  return (
    <>
      {/* Step 3: Identity Verification */}
      {currentStep === 3 && (
        <motion.div
          key="seller-step3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={onSubmitStep3} className="space-y-4 sm:space-y-5">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center sm:mb-5">
                <h2 className="text-lg font-semibold text-white sm:text-xl">Identity Verification</h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  Documents upload securely the moment you pick them. All files are encrypted.
                </p>
              </div>

              <div className="space-y-4">
                {/* Required Documents */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Required Documents</h3>
                  </div>

                  <FileUploadBox
                    label="Government-Issued ID"
                    description="Passport, national ID, or driver's license"
                    fileType="idDocument"
                    doc={uploadedDocs.idDocument}
                    onDocChange={handleDocChange}
                    required
                    error={step3Errors.idDocument}
                    sampleImage="/samples/id-sample.svg"
                    sampleText="Passport or National ID"
                  />

                  <FileUploadBox
                    label="Selfie With ID"
                    description="A selfie holding your ID with today's date written on paper"
                    fileType="selfieWithId"
                    doc={uploadedDocs.selfieWithId}
                    onDocChange={handleDocChange}
                    required
                    error={step3Errors.selfieWithId}
                    sampleImage="/samples/selfie-sample.svg"
                    sampleText="Person holding ID"
                  />

                  <FileUploadBox
                    label="Proof Of Address"
                    description="Utility bill, bank statement, or government letter (under 3 months old)"
                    fileType="proofOfAddress"
                    doc={uploadedDocs.proofOfAddress}
                    onDocChange={handleDocChange}
                    required
                    error={step3Errors.proofOfAddress}
                    sampleImage="/samples/address-sample.svg"
                    sampleText="Utility bill"
                  />
                </div>

                {/* Business Documents (conditional) */}
                {sellerType === 'business' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Business Documents</h3>
                    </div>

                    <FileUploadBox
                      label="Certificate Of Incorporation"
                      description="Official company registration document"
                      fileType="certificateOfIncorporation"
                      doc={uploadedDocs.certificateOfIncorporation}
                      onDocChange={handleDocChange}
                      sampleImage="/samples/incorporation-sample.svg"
                      sampleText="Certificate document"
                    />

                    <FileUploadBox
                      label="Business License"
                      description="Current business operating license"
                      fileType="businessLicense"
                      doc={uploadedDocs.businessLicense}
                      onDocChange={handleDocChange}
                      sampleImage="/samples/license-sample.svg"
                      sampleText="Business license"
                    />

                    <FileUploadBox
                      label="Director/Owner ID"
                      description="ID verification for company director or owner"
                      fileType="directorId"
                      doc={uploadedDocs.directorId}
                      onDocChange={handleDocChange}
                      sampleImage="/samples/id-sample.svg"
                      sampleText="Director's ID"
                    />

                    <FileUploadBox
                      label="Business Bank Statement"
                      description="Recent bank statement in company name"
                      fileType="bankStatement"
                      doc={uploadedDocs.bankStatement}
                      onDocChange={handleDocChange}
                      sampleImage="/samples/bank-statement-sample.svg"
                      sampleText="Bank statement"
                    />
                  </div>
                )}

                {/* Info Box */}
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-xs text-blue-200 sm:text-sm">
                    <span className="font-semibold">Accepted formats:</span> JPG, PNG, PDF (max 10MB each)
                    <br />
                    <span className="font-semibold">Security:</span> All documents are encrypted and auto-deleted 90 days after verification
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
                className="flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-5 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/20 sm:gap-1.5 sm:px-6 sm:text-sm"
              >
                Continue
                <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Step 4: Seller Profile Setup */}
      {currentStep === 4 && (
        <motion.div
          key="seller-step4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit4(onSubmitStep4)} className="space-y-4 sm:space-y-5">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-4 shadow-2xl backdrop-blur-3xl sm:p-5">
              <div className="mb-4 text-center sm:mb-5">
                <h2 className="text-lg font-semibold text-white sm:text-xl">Seller Profile Setup</h2>
                <p className="mt-1 text-xs text-text-secondary sm:text-sm">
                  Create your public-facing seller profile and store policies
                </p>
              </div>

              <div className="space-y-4">
                {/* Store Image Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Profile Information</h3>
                  </div>

                  {/* Store Image Upload — immediate, visible pre-approval */}
                  <FileUploadBox
                    label="Store Image"
                    description="Shown on your shop page and profile right away — even while your application is under review"
                    fileType="profile"
                    bucket="profile-pictures"
                    imageOnly
                    doc={storeImage}
                    onDocChange={handleStoreImageChange}
                  />

                  {/* Bio */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Bio / About <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <textarea
                      {...register4('bio')}
                      rows={3}
                      maxLength={500}
                      placeholder="I'm a professional seller specializing in..."
                      className={inputClass}
                    />
                    <div className="mt-1 text-right text-xs text-text-tertiary">{bio.length}/500 characters</div>
                    {errors4.bio && <p className="mt-1 text-xs text-error">{errors4.bio.message}</p>}
                  </div>
                </div>

                {/* Availability & Languages */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Availability</h3>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                      When Are You Available? <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>

                    <div className="space-y-2.5">
                      {/* Quick Select Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setValue4('businessHours', '24/7 - Always Available')
                            setValue4('timezone', 'UTC+00:00 (GMT)')
                          }}
                          className="rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-xs text-white transition-all hover:border-white/25 hover:bg-white/5 sm:text-sm"
                        >
                          24/7
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue4('businessHours', '9AM-5PM, Mon-Fri')
                            setValue4('timezone', 'Auto')
                          }}
                          className="rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-xs text-white transition-all hover:border-white/25 hover:bg-white/5 sm:text-sm"
                        >
                          Business Hours
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue4('businessHours', '6PM-12AM, Daily')
                            setValue4('timezone', 'Auto')
                          }}
                          className="rounded-lg border border-white/10 bg-bg-overlay px-3 py-2 text-xs text-white transition-all hover:border-white/25 hover:bg-white/5 sm:text-sm"
                        >
                          Evenings
                        </button>
                      </div>

                      {/* Current Selection Display */}
                      <div className="rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5">
                        <p className="text-[10px] text-text-secondary sm:text-xs">
                          Selected:{' '}
                          <span className="font-medium text-white">{watch4('businessHours') || 'Not set'}</span>
                          {watch4('timezone') && watch4('timezone') !== '' && (
                            <span className="ml-1.5 text-text-tertiary">({watch4('timezone')})</span>
                          )}
                        </p>
                      </div>

                      {/* Custom Input (Advanced) */}
                      <details className="group">
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-center gap-2 text-xs text-text-secondary transition-colors hover:text-white">
                            <span>Enter custom hours & timezone</span>
                            <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </summary>

                        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Custom Hours</label>
                            <input
                              type="text"
                              {...register4('businessHours')}
                              placeholder="e.g., 10AM-8PM, Tue-Sat"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Timezone</label>
                            <select {...register4('timezone')} className={inputClass}>
                              <option value="" className="bg-black">Auto-detect</option>
                              <option value="UTC-08:00 (PST)" className="bg-black">PST - Los Angeles</option>
                              <option value="UTC-05:00 (EST)" className="bg-black">EST - New York</option>
                              <option value="UTC+00:00 (GMT)" className="bg-black">GMT - London</option>
                              <option value="UTC+01:00 (CET)" className="bg-black">CET - Paris</option>
                              <option value="UTC+05:30 (IST)" className="bg-black">IST - Mumbai</option>
                              <option value="UTC+08:00 (SGT)" className="bg-black">SGT - Singapore</option>
                            </select>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Languages Spoken */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white sm:text-sm">
                      Languages Spoken <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {LANGUAGES.map((lang) => {
                        const isSelected = selectedLanguages.includes(lang)
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={`rounded-lg border p-2 text-xs transition-all ${
                              isSelected
                                ? 'border-primary border-2 bg-bg-overlay text-white'
                                : 'border-white/10 bg-bg-overlay text-text-secondary hover:border-white/20'
                            }`}
                          >
                            {lang}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Social Media Links (Optional)</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">Discord Username</label>
                      <input type="text" {...register4('discordUsername')} placeholder="username#1234" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">Twitter / X Handle</label>
                      <input type="text" {...register4('twitterHandle')} placeholder="@username" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">Twitch Channel</label>
                      <input type="text" {...register4('twitchChannel')} placeholder="twitch.tv/username" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">YouTube Channel</label>
                      <input type="text" {...register4('youtubeChannel')} placeholder="youtube.com/@username" className={inputClass} />
                    </div>
                  </div>
                </div>

                {/* Store Policies */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Your Store Policies</h3>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Define your own policies that will be displayed to buyers on your storefront
                    </p>
                  </div>

                  {/* Refund Policy */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Your Refund Policy <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>

                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setValue4('refundPolicy', 'No refunds once order is delivered and verified.')}
                        className="rounded-md border border-white/10 bg-bg-overlay px-3 py-1.5 text-[10px] text-text-secondary transition-all hover:border-white/25 hover:bg-white/5 hover:text-white sm:text-xs"
                      >
                        No Refunds
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue4('refundPolicy', 'Full refund within 24 hours if item not as described.')}
                        className="rounded-md border border-white/10 bg-bg-overlay px-3 py-1.5 text-[10px] text-text-secondary transition-all hover:border-white/25 hover:bg-white/5 hover:text-white sm:text-xs"
                      >
                        24h Refund Window
                      </button>
                    </div>

                    <textarea
                      {...register4('refundPolicy')}
                      rows={2}
                      placeholder="e.g., Full refund within 24 hours if item not as described."
                      className={inputClass}
                    />
                  </div>

                  {/* Delivery Timeframe */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Your Delivery Timeframe <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>

                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setValue4('deliveryTimeframe', 'Instant delivery (usually within minutes)')}
                        className="rounded-md border border-white/10 bg-bg-overlay px-3 py-1.5 text-[10px] text-text-secondary transition-all hover:border-white/25 hover:bg-white/5 hover:text-white sm:text-xs"
                      >
                        Instant
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue4('deliveryTimeframe', 'Within 24 hours')}
                        className="rounded-md border border-white/10 bg-bg-overlay px-3 py-1.5 text-[10px] text-text-secondary transition-all hover:border-white/25 hover:bg-white/5 hover:text-white sm:text-xs"
                      >
                        Within 24h
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue4('deliveryTimeframe', '1-3 business days')}
                        className="rounded-md border border-white/10 bg-bg-overlay px-3 py-1.5 text-[10px] text-text-secondary transition-all hover:border-white/25 hover:bg-white/5 hover:text-white sm:text-xs"
                      >
                        1-3 Days
                      </button>
                    </div>

                    <input
                      type="text"
                      {...register4('deliveryTimeframe')}
                      placeholder="e.g., Within 24 hours, Instant delivery"
                      className={inputClass}
                    />
                  </div>

                  {/* Terms of Service */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Your Terms Of Service <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <textarea
                      {...register4('termsOfService')}
                      rows={2}
                      placeholder="e.g., By purchasing, you agree to provide accurate account details."
                      className={inputClass}
                    />
                  </div>

                  {/* Info Notice */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <p className="text-xs text-blue-200 sm:text-sm">
                      <span className="font-semibold">Note:</span> These are YOUR seller policies shown to buyers.
                      You&apos;ll accept DropMarket&apos;s platform terms in the final step.
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
    </>
  )
}
