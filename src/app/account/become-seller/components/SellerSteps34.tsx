/**
 * Seller Registration - Steps 3 & 4
 *
 * Step 3: Identity Verification (KYC)
 * - Government-issued ID upload
 * - Selfie with ID verification
 * - Proof of address
 * - Business documents (conditional for business accounts)
 *
 * Step 4: Seller Profile Setup
 * - Profile picture/logo upload
 * - Bio and store description
 * - Business hours and timezone
 * - Languages spoken
 * - Social media links
 * - Store policies (refund, delivery, terms)
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, ChevronLeft, User, X } from 'lucide-react'

import { step3Schema, step4Schema, type Step3FormData, type Step4FormData } from '../schemas'
import { LANGUAGES, TIMEZONES } from '../constants'
import FileUploadBox from './shared/FileUploadBox'

interface SellerSteps34Props {
  currentStep: number
  onStepComplete: (step: number, data: Step3FormData | Step4FormData) => void
  onStepBack?: () => void
  initialData?: {
    step3?: Partial<Step3FormData>
    step4?: Partial<Step4FormData>
  }
  // Props for file uploads and state management
  uploadedFiles: {
    idDocument: File | null
    selfieWithId: File | null
    proofOfAddress: File | null
    certificateOfIncorporation: File | null
    businessLicense: File | null
    directorId: File | null
    bankStatement: File | null
  }
  onFileUpload: (fileType: string, file: File | null) => void
  profilePicture: File | null
  onProfilePictureChange: (file: File | null) => void
  selectedLanguages: string[]
  onLanguagesChange: (languages: string[]) => void
  sellerType?: 'individual' | 'business'
}

export default function SellerSteps34({
  currentStep,
  onStepComplete,
  onStepBack,
  initialData,
  uploadedFiles,
  onFileUpload,
  profilePicture,
  onProfilePictureChange,
  selectedLanguages,
  onLanguagesChange,
  sellerType,
}: SellerSteps34Props) {
  // Step 3 Form
  const {
    handleSubmit: handleSubmit3,
    formState: { errors: errors3 },
  } = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    defaultValues: initialData?.step3 || {},
  })

  const onSubmitStep3 = (data: Step3FormData) => {
    console.log('Step 3 data:', data)
    onStepComplete(3, data)
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
    console.log('Step 4 data:', data)
    onStepComplete(4, data)
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
          <form onSubmit={handleSubmit3(onSubmitStep3)} className="space-y-5 sm:space-y-6">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-5 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  Identity Verification
                </h2>
                <p className="mt-1.5 text-xs text-text-secondary sm:text-sm">
                  Upload your documents for KYC verification. All files are encrypted and stored securely.
                </p>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {/* Required Documents for Individuals */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Required Documents</h3>
                  </div>

                  {/* Government ID */}
                  <FileUploadBox
                    label="Government-Issued ID"
                    description="Upload passport, national ID, or driver's license"
                    fileType="idDocument"
                    uploadedFile={uploadedFiles.idDocument}
                    onFileUpload={onFileUpload}
                    required
                    sampleImage="/samples/id-sample.svg"
                    sampleText="Example: Passport or National ID"
                  />

                  {/* Selfie with ID */}
                  <FileUploadBox
                    label="Selfie with ID"
                    description="Take a selfie holding your ID with today's date written on paper"
                    fileType="selfieWithId"
                    uploadedFile={uploadedFiles.selfieWithId}
                    onFileUpload={onFileUpload}
                    required
                    sampleImage="/samples/selfie-sample.svg"
                    sampleText="Example: Person holding ID"
                  />

                  {/* Proof of Address */}
                  <FileUploadBox
                    label="Proof of Address"
                    description="Utility bill, bank statement, or government letter (less than 3 months old)"
                    fileType="proofOfAddress"
                    uploadedFile={uploadedFiles.proofOfAddress}
                    onFileUpload={onFileUpload}
                    required
                    sampleImage="/samples/address-sample.svg"
                    sampleText="Example: Utility bill"
                  />
                </div>

                {/* Business Documents (conditional) */}
                {sellerType === 'business' && (
                  <div className="space-y-4 sm:space-y-5">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Business Documents</h3>
                    </div>

                    {/* Certificate of Incorporation */}
                    <FileUploadBox
                      label="Certificate of Incorporation"
                      description="Official company registration document"
                      fileType="certificateOfIncorporation"
                      uploadedFile={uploadedFiles.certificateOfIncorporation}
                      onFileUpload={onFileUpload}
                      sampleImage="/samples/incorporation-sample.svg"
                      sampleText="Example: Certificate document"
                    />

                    {/* Business License */}
                    <FileUploadBox
                      label="Business License"
                      description="Current business operating license"
                      fileType="businessLicense"
                      uploadedFile={uploadedFiles.businessLicense}
                      onFileUpload={onFileUpload}
                      sampleImage="/samples/license-sample.svg"
                      sampleText="Example: Business license"
                    />

                    {/* Director ID */}
                    <FileUploadBox
                      label="Director/Owner ID"
                      description="ID verification for company director or owner"
                      fileType="directorId"
                      uploadedFile={uploadedFiles.directorId}
                      onFileUpload={onFileUpload}
                      sampleImage="/samples/id-sample.svg"
                      sampleText="Example: Director's ID"
                    />

                    {/* Bank Statement */}
                    <FileUploadBox
                      label="Business Bank Statement"
                      description="Recent bank statement in company name"
                      fileType="bankStatement"
                      uploadedFile={uploadedFiles.bankStatement}
                      onFileUpload={onFileUpload}
                      sampleImage="/samples/bank-statement-sample.svg"
                      sampleText="Example: Bank statement"
                    />
                  </div>
                )}

                {/* Info Box */}
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4">
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

      {/* Step 4: Seller Profile Setup */}
      {currentStep === 4 && (
        <motion.div
          key="seller-step4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <form onSubmit={handleSubmit4(onSubmitStep4)} className="space-y-5 sm:space-y-6">
            {/* Glassmorphic Card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] p-5 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8">
              <div className="mb-5 text-center sm:mb-6">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl">
                  Seller Profile Setup
                </h2>
                <p className="mt-1.5 text-xs text-text-secondary sm:text-sm">
                  Create your public-facing seller profile and store policies
                </p>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {/* Profile Picture Section */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Profile Information</h3>
                  </div>

                  {/* Profile Picture Upload */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Profile Picture / Logo
                    </label>
                    <p className="mb-3 text-[10px] text-text-secondary sm:text-xs">
                      Upload a profile picture or your business logo
                    </p>

                    {!profilePicture ? (
                      <div className="group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-gradient-to-br from-white/[0.05] to-white/[0.02] transition-all hover:border-primary/50">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) onProfilePictureChange(file)
                          }}
                          className="absolute inset-0 z-10 cursor-pointer opacity-0"
                        />
                        <div className="flex flex-col items-center gap-3 p-6 sm:flex-row sm:gap-4 sm:p-8">
                          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white/5 group-hover:bg-primary/10 sm:h-24 sm:w-24">
                            <User className="h-10 w-10 text-text-secondary group-hover:text-primary sm:h-12 sm:w-12" />
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-sm font-medium text-white sm:text-base">
                              Click to upload or <span className="text-primary">browse</span>
                            </p>
                            <p className="mt-1 text-xs text-text-tertiary sm:text-sm">JPG or PNG (max 5MB)</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-4 sm:gap-4 sm:p-5">
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-primary/30 sm:h-24 sm:w-24">
                          <Image
                            src={URL.createObjectURL(profilePicture)}
                            alt="Profile preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white sm:text-base">
                            {profilePicture.name}
                          </p>
                          <p className="mt-0.5 text-xs text-text-secondary sm:text-sm">
                            {(profilePicture.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onProfilePictureChange(null)}
                          className="flex-shrink-0 rounded-lg p-2 transition-all hover:bg-error-bg"
                        >
                          <X className="h-5 w-5 text-error sm:h-6 sm:w-6" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Bio / About{' '}
                      <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <p className="mb-2 text-[10px] text-text-secondary sm:text-xs">
                      Tell buyers about yourself and what you offer
                    </p>
                    <textarea
                      {...register4('bio')}
                      rows={4}
                      maxLength={500}
                      placeholder="I'm a professional seller specializing in..."
                      className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                    />
                    <div className="mt-1.5 text-right text-xs text-text-tertiary">
                      {bio.length}/500 characters
                    </div>
                  </div>
                </div>

                {/* Business Hours & Languages */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">Availability</h3>
                  </div>

                  {/* Availability Options */}
                  <div>
                    <label className="mb-3 block text-xs font-medium text-white sm:text-sm">
                      When are you available? <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>

                    <div className="space-y-3">
                      {/* Quick Select Buttons */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => {
                            setValue4('businessHours', '24/7 - Always Available')
                            setValue4('timezone', 'UTC+00:00 (GMT)')
                          }}
                          className="px-4 py-2.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-lg text-xs sm:text-sm text-white transition-all"
                        >
                          ⏰ 24/7
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue4('businessHours', '9AM-5PM, Mon-Fri')
                            setValue4('timezone', 'Auto')
                          }}
                          className="px-4 py-2.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-lg text-xs sm:text-sm text-white transition-all"
                        >
                          🏢 Business Hours
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue4('businessHours', '6PM-12AM, Daily')
                            setValue4('timezone', 'Auto')
                          }}
                          className="px-4 py-2.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-lg text-xs sm:text-sm text-white transition-all"
                        >
                          🌙 Evenings
                        </button>
                      </div>

                      {/* Current Selection Display */}
                      <div className="bg-bg-overlay border border-white/10 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">📅</div>
                          <div className="flex-1">
                            <p className="text-xs text-text-secondary mb-1">Selected:</p>
                            <p className="text-sm text-white font-medium">
                              {watch4('businessHours') || 'Not set'}
                            </p>
                            {watch4('timezone') && watch4('timezone') !== '' && (
                              <p className="text-xs text-text-tertiary mt-1">
                                {watch4('timezone')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Custom Input (Advanced) */}
                      <details className="group">
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-center gap-2 text-xs text-text-secondary hover:text-lime-text transition-colors">
                            <span>✏️ Enter custom hours & timezone</span>
                            <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </summary>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 pl-6">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                              Custom Hours
                            </label>
                            <input
                              type="text"
                              {...register4('businessHours')}
                              placeholder="e.g., 10AM-8PM, Tue-Sat"
                              className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                              Timezone
                            </label>
                            <select
                              {...register4('timezone')}
                              className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                            >
                              <option value="" className="bg-black">Auto-detect</option>
                              <option value="UTC-08:00 (PST)" className="bg-black">PST - Los Angeles</option>
                              <option value="UTC-05:00 (EST)" className="bg-black">EST - New York</option>
                              <option value="UTC+00:00 (GMT)" className="bg-black">GMT - London</option>
                              <option value="UTC+01:00 (CET)" className="bg-black">CET - Paris</option>
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
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {LANGUAGES.map((lang) => {
                        const isSelected = selectedLanguages.includes(lang)
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={`rounded-lg border p-2 text-xs transition-all sm:p-2.5 sm:text-sm ${
                              isSelected
                                ? 'border-primary border-2 bg-bg-overlay text-white'
                                : 'border-white/10 bg-bg-overlay text-text-secondary hover:border-white/20 hover:bg-bg-overlay'
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
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold text-white sm:text-sm">
                      Social Media Links (Optional)
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    {/* Discord */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Discord Username
                      </label>
                      <input
                        type="text"
                        {...register4('discordUsername')}
                        placeholder="username#1234"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                    </div>

                    {/* Twitter */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Twitter / X Handle
                      </label>
                      <input
                        type="text"
                        {...register4('twitterHandle')}
                        placeholder="@username"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                    </div>

                    {/* Twitch */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        Twitch Channel
                      </label>
                      <input
                        type="text"
                        {...register4('twitchChannel')}
                        placeholder="twitch.tv/username"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                    </div>

                    {/* YouTube */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                        YouTube Channel
                      </label>
                      <input
                        type="text"
                        {...register4('youtubeChannel')}
                        placeholder="youtube.com/@username"
                        className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Store Policies */}
                <div className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold text-white sm:text-sm">Your Store Policies</h3>
                    </div>
                    <p className="text-xs text-text-secondary">
                      📋 Define your own policies that will be displayed to buyers on your storefront
                    </p>
                  </div>

                  {/* Refund Policy */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Your Refund Policy <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <p className="mb-2 text-[10px] text-text-tertiary sm:text-xs">
                      Tell buyers about YOUR refund conditions (e.g., "No refunds after delivery", "24h refund window", etc.)
                    </p>

                    {/* Quick Options */}
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setValue4('refundPolicy', 'No refunds once order is delivered and verified.')}
                        className="px-3 py-1.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-md text-[10px] sm:text-xs text-text-secondary hover:text-white transition-all"
                      >
                        📦 No Refunds
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue4('refundPolicy', 'Full refund within 24 hours if item not as described.')}
                        className="px-3 py-1.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-md text-[10px] sm:text-xs text-text-secondary hover:text-white transition-all"
                      >
                        🔄 24h Refund Window
                      </button>
                    </div>

                    <textarea
                      {...register4('refundPolicy')}
                      rows={3}
                      placeholder="e.g., Full refund within 24 hours if item not as described. No refunds after successful delivery."
                      className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                    />
                  </div>

                  {/* Delivery Timeframe */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Your Delivery Timeframe <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <p className="mb-2 text-[10px] text-text-tertiary sm:text-xs">
                      Set expectations for buyers about when they'll receive their items
                    </p>

                    {/* Quick Options */}
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setValue4('deliveryTimeframe', 'Instant delivery (usually within minutes)')}
                        className="px-3 py-1.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-md text-[10px] sm:text-xs text-text-secondary hover:text-white transition-all"
                      >
                        ⚡ Instant
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue4('deliveryTimeframe', 'Within 24 hours')}
                        className="px-3 py-1.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-md text-[10px] sm:text-xs text-text-secondary hover:text-white transition-all"
                      >
                        📅 Within 24h
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue4('deliveryTimeframe', '1-3 business days')}
                        className="px-3 py-1.5 bg-bg-overlay hover:bg-bg-raised-hover border border-white/10 hover:border-lime rounded-md text-[10px] sm:text-xs text-text-secondary hover:text-white transition-all"
                      >
                        🕐 1-3 Days
                      </button>
                    </div>

                    <input
                      type="text"
                      {...register4('deliveryTimeframe')}
                      placeholder="e.g., Within 24 hours, Instant delivery, 1-3 business days"
                      className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                    />
                  </div>

                  {/* Terms of Service */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white sm:text-sm">
                      Your Terms of Service <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <p className="mb-2 text-[10px] text-text-tertiary sm:text-xs">
                      Any additional rules or requirements buyers should know before purchasing from you
                    </p>
                    <textarea
                      {...register4('termsOfService')}
                      rows={3}
                      placeholder="e.g., By purchasing, you agree to provide accurate account details. I am not responsible for bans due to incorrect information."
                      className="w-full rounded-lg border border-white/10 bg-bg-overlay px-3 py-2.5 text-xs text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:px-4 sm:py-3 sm:text-sm"
                    />
                  </div>

                  {/* Info Notice */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4">
                    <p className="text-xs text-blue-200 sm:text-sm">
                      <span className="font-semibold">ℹ️ Note:</span> These are YOUR seller policies shown to buyers.
                      You'll accept DropMarket's platform terms in the final step.
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
    </>
  )
}
