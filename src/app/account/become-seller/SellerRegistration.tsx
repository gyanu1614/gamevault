/**
 * SellerRegistration - Main Orchestrator Component
 *
 * Manages the entire seller registration flow across 6 steps.
 * Handles state management, navigation, and data collection.
 *
 * Architecture:
 * - Renders SellerProgressBar for visual progress
 * - Conditionally renders step group components (Steps12, Steps34, Steps56)
 * - Manages all form data and shared state (files, languages, etc.)
 * - Coordinates step-to-step navigation
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Rocket, Loader2, CheckCircle, ArrowRight, DollarSign, Zap, Clock, Headphones, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import SellerProgressBar from './components/SellerProgressBar'
import SellerSteps12 from './components/SellerSteps12'
import SellerSteps34 from './components/SellerSteps34'
import SellerSteps56 from './components/SellerSteps56'
import SubmissionLoader from './components/SubmissionLoader'
import PreviousDataModal from './components/PreviousDataModal'
import { submitSellerApplication } from '@/lib/actions/seller-application'
import { getApplicationStatus } from '@/lib/actions/seller-application-status'
import { verifyTurnstileToken } from '@/lib/actions/verify-turnstile'
import { TurnstileWidget } from '@/components/ui/TurnstileWidget'
import type {
  Step1FormData,
  Step2FormData,
  Step3FormData,
  Step4FormData,
  Step5FormData,
  Step6FormData,
} from './types'

const TOTAL_STEPS = 6

interface SellerFormData {
  step1?: Step1FormData
  step2?: Step2FormData
  step3?: Step3FormData
  step4?: Step4FormData
  step5?: Step5FormData
  step6?: Step6FormData
}

export default function SellerRegistration() {
  const router = useRouter()

  // Core navigation state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<SellerFormData>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingExisting, setIsCheckingExisting] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Previous data auto-fill state
  const [showPreviousDataModal, setShowPreviousDataModal] = useState(false)
  const [previousApplication, setPreviousApplication] = useState<any>(null)
  const [previousWithdrawal, setPreviousWithdrawal] = useState<any>(null)
  const [isPrefilled, setIsPrefilled] = useState(false)

  // P2.7 — Turnstile CAPTCHA state
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Submission loader state
  const [loaderStage, setLoaderStage] = useState<'uploading' | 'submitting' | 'complete'>('uploading')
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [loaderMessage, setLoaderMessage] = useState('Preparing files...')

  // Shared state for file uploads (Step 3)
  const [uploadedFiles, setUploadedFiles] = useState<{
    idDocument: File | null
    selfieWithId: File | null
    proofOfAddress: File | null
    certificateOfIncorporation: File | null
    businessLicense: File | null
    directorId: File | null
    bankStatement: File | null
  }>({
    idDocument: null,
    selfieWithId: null,
    proofOfAddress: null,
    certificateOfIncorporation: null,
    businessLicense: null,
    directorId: null,
    bankStatement: null,
  })

  // Shared state for profile setup (Step 4)
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])

  /**
   * Smooth scroll to progress bar when step changes
   */
  useEffect(() => {
    // Find the progress bar element and scroll a bit above it
    const progressBar = document.querySelector('[data-progress-bar]')
    if (progressBar) {
      const elementPosition = progressBar.getBoundingClientRect().top + window.pageYOffset
      const offsetPosition = elementPosition - 120 // Scroll 120px above the progress bar

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }, [currentStep])

  /**
   * Check for existing application on mount
   * Redirect to status page only if application cannot be reapplied
   *
   * Allow new application if:
   * - No application exists
   * - Application is withdrawn
   * - Application is rejected and cooldown has expired
   *
   * Show auto-fill modal if:
   * - Application is withdrawn within 90 days
   * - Withdrawal count < 5 (spam prevention)
   *
   * Redirect to status page if:
   * - Application is pending or under review
   * - Application is approved
   * - Application is rejected and still in cooldown
   */
  useEffect(() => {
    async function checkExistingApplication() {
      try {
        const result = await getApplicationStatus()

        if (result.success && result.data) {
          const { status, canReapply, withdrawal, application } = result.data

          // Check if user should be redirected to status page
          const shouldRedirect =
            status === 'pending' ||
            status === 'under_review' ||
            status === 'approved' ||
            (status === 'rejected' && !canReapply)

          if (shouldRedirect) {
            // User has an active application or is in cooldown, redirect
            setIsCheckingExisting(false)
            setIsRedirecting(true)

            // Redirect after 2 seconds
            setTimeout(() => {
              router.push('/account/seller-status')
            }, 2000)
            return
          }

          // Check if we should show auto-fill modal for withdrawn applications
          if (status === 'withdrawn' && withdrawal && application) {
            const withdrawnDate = new Date(withdrawal.withdrawnAt)
            const daysSinceWithdrawal = Math.floor(
              (Date.now() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            const withdrawalCount = withdrawal.withdrawalCount || 0

            // Show auto-fill modal if:
            // 1. Withdrawn within 90 days
            // 2. Withdrawal count < 5 (spam prevention)
            const shouldShowAutoFill = daysSinceWithdrawal <= 90 && withdrawalCount < 5

            if (shouldShowAutoFill) {
              setPreviousApplication(application)
              setPreviousWithdrawal(withdrawal)
              setShowPreviousDataModal(true)
            }
          }

          // User can reapply, show registration form
          setIsCheckingExisting(false)
        } else {
          // No existing application, show registration form
          setIsCheckingExisting(false)
        }
      } catch (error) {
        console.error('Error checking existing application:', error)
        // On error, allow user to proceed with registration
        setIsCheckingExisting(false)
      }
    }

    checkExistingApplication()
  }, [router])

  /**
   * Handler for "Use Previous Data" button
   * Pre-populates form with data from withdrawn application
   */
  const handleUsePreviousData = () => {
    if (!previousApplication) return

    // Transform previous application data to form data structure
    const prefilledData: SellerFormData = {
      step1: {
        displayName: previousApplication.display_name || '',
        shopName: previousApplication.shop_name || '',
        fullLegalName: previousApplication.full_legal_name || '',
        sellerType: previousApplication.seller_type || 'individual',
        phoneNumber: previousApplication.phone_number || '',
        alternateEmail: previousApplication.alternate_email || '',
        country: previousApplication.country || '',
        stateProvince: previousApplication.state_province || '',
        city: previousApplication.city || '',
      },
      step2: previousApplication.seller_type === 'business'
        ? {
            companyLegalName: previousApplication.company_legal_name || '',
            businessRegistrationNumber: previousApplication.business_registration_number || '',
            taxIdVat: previousApplication.tax_id_vat || '',
            companyAddress: previousApplication.company_address || '',
            businessType: previousApplication.business_type || '',
            yearEstablished: previousApplication.year_established || new Date().getFullYear(),
            businessEmail: previousApplication.business_email || '',
            businessPhone: previousApplication.business_phone || '',
          }
        : undefined,
      step3: undefined, // Don't pre-fill documents for security
      step4: {
        profileBio: previousApplication.profile_bio || '',
        languagesSpoken: previousApplication.languages_spoken || [],
        businessHours: previousApplication.business_hours || '',
        timezone: previousApplication.timezone || '',
        discordUsername: previousApplication.discord_username || '',
        twitterHandle: previousApplication.twitter_handle || '',
        twitchChannel: previousApplication.twitch_channel || '',
        youtubeChannel: previousApplication.youtube_channel || '',
      },
      step5: {
        primaryGames: previousApplication.primary_games || [],
        expectedMonthlyVolume: previousApplication.expected_monthly_volume || '',
        refundPolicy: previousApplication.refund_policy || '',
        deliveryTimeframe: previousApplication.delivery_timeframe || '',
        termsOfService: previousApplication.terms_of_service || '',
      },
      step6: {
        payoutMethod: previousApplication.payout_method || 'bank_transfer',
        bankAccountHolderName: previousApplication.bank_account_holder_name || '',
        bankName: previousApplication.bank_name || '',
        paypalEmail: previousApplication.paypal_email || '',
        cryptoWalletAddress: previousApplication.crypto_wallet_address || '',
        taxResidencyCountry: previousApplication.tax_residency_country || '',
      },
    }

    // Update languages for Step 4
    if (previousApplication.languages_spoken) {
      setSelectedLanguages(previousApplication.languages_spoken)
    }

    // Set the pre-filled form data
    setFormData(prefilledData)
    setIsPrefilled(true)
    setShowPreviousDataModal(false)

    // Show success toast
    toast.success('Previous application data loaded! You can edit any field.')
  }

  /**
   * Handler for "Start Fresh" button
   * Closes modal and starts with empty form
   */
  const handleStartFresh = () => {
    setShowPreviousDataModal(false)
    setPreviousApplication(null)
    setIsPrefilled(false)
  }

  /**
   * Handles completion of any step
   * Stores the step data and advances to next step
   */
  const handleStepComplete = (
    step: number,
    data: Step1FormData | Step2FormData | Step3FormData | Step4FormData | Step5FormData | Step6FormData
  ) => {
    console.log(`Step ${step} completed:`, data)

    // Store step data
    setFormData((prev) => ({
      ...prev,
      [`step${step}`]: data,
    }))

    // Move to next step
    setCurrentStep(step + 1)
  }

  /**
   * Handles file upload changes for document verification (Step 3)
   */
  const handleFileUpload = (fileType: string, file: File | null) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [fileType]: file,
    }))
  }

  /**
   * Handles final submission (Step 6)
   * Accepts step6Data directly to avoid race condition with state updates
   */
  const handleFinalSubmit = async (step6Data: Step6FormData) => {
    // Validate that we have required data
    if (!formData.step1 || !formData.step2) {
      toast.error('Missing required information. Please complete all steps.')
      return
    }

    // P2.7 — Verify Turnstile CAPTCHA before submitting application
    if (turnstileEnabled) {
      const captcha = await verifyTurnstileToken(turnstileToken)
      if (!captcha.success) {
        toast.error(captcha.error || 'CAPTCHA verification failed. Please try again.')
        setTurnstileToken('')
        return
      }
    }

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Step 1: Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Authentication error. Please log in again.')
        setIsSubmitting(false)
        return
      }

      // Step 2: Upload files to Supabase Storage
      const uploadedFilePaths: Record<string, { path: string; name: string; size: number; type: string } | null> = {}
      const totalFiles = Object.values(uploadedFiles).filter(f => f !== null).length
      let currentFileCount = 0

      // Initialize loader
      setLoaderStage('uploading')
      setUploadProgress({ current: 0, total: totalFiles })
      setLoaderMessage('Uploading your documents securely...')

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file) {
          try {
            // Generate unique file name
            const timestamp = Date.now()
            const fileExtension = file.name.split('.').pop()
            const fileName = `${user.id}/${key}-${timestamp}.${fileExtension}`

            // Upload to kyc-documents bucket
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('kyc-documents')
              .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
              })

            if (uploadError) {
              console.error(`Error uploading ${key}:`, uploadError)
              throw new Error(`Failed to upload ${key}`)
            }

            // Store file metadata
            uploadedFilePaths[key] = {
              path: uploadData.path,
              name: file.name,
              size: file.size,
              type: file.type,
            }

            currentFileCount++
            setUploadProgress({ current: currentFileCount, total: totalFiles })
          } catch (uploadErr) {
            console.error(`Upload error for ${key}:`, uploadErr)
            toast.error(`Failed to upload ${key}. Please try again.`)
            setIsSubmitting(false)
            return
          }
        }
      }

      // Step 3: Upload profile picture (if any)
      let profilePicturePath: { path: string; name: string; size: number; type: string } | null = null
      if (profilePicture) {
        try {
          const timestamp = Date.now()
          const fileExtension = profilePicture.name.split('.').pop()
          const fileName = `${user.id}/profile-${timestamp}.${fileExtension}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-pictures')
            .upload(fileName, profilePicture, {
              cacheControl: '3600',
              upsert: true,
            })

          if (uploadError) {
            console.error('Error uploading profile picture:', uploadError)
          } else {
            profilePicturePath = {
              path: uploadData.path,
              name: profilePicture.name,
              size: profilePicture.size,
              type: profilePicture.type,
            }
          }
        } catch (err) {
          console.error('Profile picture upload error:', err)
          // Non-critical, continue with submission
        }
      }

      // Update loader to submission stage
      setLoaderStage('submitting')
      setLoaderMessage('Processing your application...')

      // Step 4: Submit to backend with file paths
      const result = await submitSellerApplication({
        step1: formData.step1,
        step2: formData.step2,
        step3: formData.step3,
        step4: formData.step4,
        step5: formData.step5,
        step6: step6Data, // Use directly passed data
        uploadedFilePaths, // Pass file paths instead of file names
        profilePicturePath,
        selectedLanguages,
      })

      if (result.success) {
        // Show completion
        setLoaderStage('complete')
        setLoaderMessage('Success! Redirecting...')

        // Show success toast
        toast.success(result.message || 'Application submitted successfully! You will receive an email confirmation shortly.')

        // Redirect to application status page
        setTimeout(() => {
          router.push('/account/seller-status')
        }, 2000)
      } else {
        toast.error(result.error || 'Failed to submit application. Please try again.')
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Submission error:', error)
      toast.error('An unexpected error occurred. Please try again later.')
      setIsSubmitting(false)
    }
  }

  /**
   * Handles navigation back to previous step
   */
  const handleStepBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Show loading state while checking for existing application
  if (isCheckingExisting) {
    return (
      <div className="min-h-screen bg-black">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-black/90" />
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-gray-400">Checking your application status...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show redirect modal if user already has an application
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-black">
        {/* Background */}
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-black/90" />
        </div>

        {/* Blur Overlay */}
        <div className="fixed inset-0 z-40 backdrop-blur-md bg-black/60" />

        {/* Centered Modal */}
        <div className="relative z-50 flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            {/* Modal Card */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl">
              {/* Gradient Border Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 via-transparent to-indigo-500/20 opacity-50" />

              {/* Content */}
              <div className="relative p-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-violet-500/30 blur-xl" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-center text-2xl font-bold text-white mb-3">
                  Application Found
                </h2>

                {/* Message */}
                <p className="text-center text-gray-400 mb-6">
                  You already have an application in progress. Redirecting you to your application status page...
                </p>

                {/* Loading Animation */}
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  <span className="text-sm font-medium text-violet-400">
                    Redirecting
                  </span>
                  <ArrowRight className="h-4 w-4 text-violet-400 animate-pulse" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Main Content - Compact */}
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
        {/* Compact Header - Horizontal Layout */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex-1">
              {/* 0% Fee Badge */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-full"
              >
                <Sparkles className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-semibold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  0% Fee + 0% Commission
                </span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight"
              >
                Become a Seller
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-sm text-gray-400 max-w-xl"
              >
                Join thousands of sellers. Keep 100% of your earnings.
              </motion.p>
            </div>

            {/* Benefits - Horizontal on desktop */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="flex flex-wrap gap-2 lg:gap-3"
            >
              {[
                { label: 'Zero Fees', icon: DollarSign, color: 'text-green-400' },
                { label: 'Instant', icon: Zap, color: 'text-yellow-400' },
                { label: 'Fast Payouts', icon: Clock, color: 'text-blue-400' },
                { label: '24/7 Support', icon: Headphones, color: 'text-purple-400' },
              ].map((benefit) => (
                <div
                  key={benefit.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                >
                  <benefit.icon className={`h-3.5 w-3.5 ${benefit.color}`} />
                  <span className="text-xs font-medium text-gray-300">
                    {benefit.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Progress Bar and Step Indicator - Combined Row */}
          <div className="flex items-center gap-4">
            <div data-progress-bar className="flex-1">
              <SellerProgressBar currentStep={currentStep} />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] whitespace-nowrap"
            >
              <Rocket className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-gray-300">
                Step <span className="text-violet-400 font-semibold">{currentStep}</span>/{TOTAL_STEPS}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          {/* Steps 1 & 2: Eligibility and Information */}
          {(currentStep === 1 || currentStep === 2) && (
            <SellerSteps12
              currentStep={currentStep}
              onStepComplete={handleStepComplete}
              onStepBack={handleStepBack}
              initialData={{
                step1: formData.step1,
                step2: formData.step2,
              }}
            />
          )}

          {/* Steps 3 & 4: Verification and Profile */}
          {(currentStep === 3 || currentStep === 4) && (
            <SellerSteps34
              currentStep={currentStep}
              onStepComplete={handleStepComplete}
              onStepBack={handleStepBack}
              sellerType={formData.step1?.sellerType}
              uploadedFiles={uploadedFiles}
              onFileUpload={handleFileUpload}
              profilePicture={profilePicture}
              onProfilePictureChange={setProfilePicture}
              selectedLanguages={selectedLanguages}
              onLanguagesChange={setSelectedLanguages}
              initialData={{
                step3: formData.step3,
                step4: formData.step4,
              }}
            />
          )}

          {/* Steps 5 & 6: Payment and Review */}
          {(currentStep === 5 || currentStep === 6) && (
            <SellerSteps56
              currentStep={currentStep}
              onStepComplete={handleStepComplete}
              onStepBack={handleStepBack}
              onSubmitApplication={handleFinalSubmit}
              isSubmitting={isSubmitting}
              initialData={{
                step5: formData.step5,
                step6: formData.step6,
              }}
            />
          )}
        </AnimatePresence>

        {/* P2.7 — Turnstile CAPTCHA on final step */}
        {currentStep === 6 && turnstileEnabled && (
          <div className="mt-6">
            <TurnstileWidget
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              className="flex justify-center"
            />
          </div>
        )}
      </div>

      {/* Submission Loader */}
      {isSubmitting && (
        <SubmissionLoader
          currentFile={uploadProgress.current}
          totalFiles={uploadProgress.total}
          stage={loaderStage}
          message={loaderMessage}
        />
      )}

      {/* Previous Data Modal */}
      {previousApplication && previousWithdrawal && (
        <PreviousDataModal
          isOpen={showPreviousDataModal}
          withdrawnAt={previousWithdrawal.withdrawnAt}
          withdrawalCount={previousWithdrawal.withdrawalCount}
          onUseData={handleUsePreviousData}
          onStartFresh={handleStartFresh}
        />
      )}
    </div>
  )
}
