/**
 * SellerRegistration - Main Orchestrator Component
 *
 * Manages the entire seller registration flow across 6 steps.
 * Handles state management, navigation, and data collection.
 *
 * Architecture:
 * - Renders SellerProgressBar for visual progress
 * - Conditionally renders step group components (Steps12, Steps34, Steps56)
 * - Owns shared state: form data, immediately-uploaded KYC docs, store image
 * - Documents upload the moment they are picked (see useImmediateUpload);
 *   final submit only persists metadata — no upload loops here.
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Rocket, Loader2, CheckCircle, ArrowRight, DollarSign, Zap, Clock, Headphones, Percent, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
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
import { COUNTRIES, OTHER_COUNTRY } from './data/countries'
import type {
  Step1FormData,
  Step2FormData,
  Step3FormData,
  Step4FormData,
  Step5FormData,
  Step6FormData,
  UploadedDoc,
  UploadedDocsState,
  WizardGame,
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

const EMPTY_DOCS: UploadedDocsState = {
  idDocument: null,
  selfieWithId: null,
  proofOfAddress: null,
  certificateOfIncorporation: null,
  businessLicense: null,
  directorId: null,
  bankStatement: null,
}

interface SellerRegistrationProps {
  /** Full active games list from the DB (fetched server-side in page.tsx). */
  games: WizardGame[]
}

export default function SellerRegistration({ games }: SellerRegistrationProps) {
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

  // P2.7 — Turnstile CAPTCHA state
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Submission loader state (files already uploaded — only submit + done)
  const [loaderStage, setLoaderStage] = useState<'submitting' | 'complete'>('submitting')

  // Shared state — documents upload IMMEDIATELY on pick (Step 3)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocsState>(EMPTY_DOCS)

  // Shared state for profile setup (Step 4)
  const [storeImage, setStoreImage] = useState<UploadedDoc | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])

  /**
   * Smooth scroll to progress bar when step changes
   */
  useEffect(() => {
    const progressBar = document.querySelector('[data-progress-bar]')
    if (progressBar) {
      const elementPosition = progressBar.getBoundingClientRect().top + window.pageYOffset
      const offsetPosition = elementPosition - 120

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }, [currentStep])

  /**
   * Check for existing application on mount
   * Redirect to status page only if application cannot be reapplied
   */
  useEffect(() => {
    async function checkExistingApplication() {
      try {
        const result = await getApplicationStatus()

        if (result.success && result.data) {
          const { status, canReapply, withdrawal, application } = result.data

          const shouldRedirect =
            status === 'pending' ||
            status === 'under_review' ||
            status === 'approved' ||
            (status === 'rejected' && !canReapply)

          if (shouldRedirect) {
            setIsCheckingExisting(false)
            setIsRedirecting(true)
            setTimeout(() => {
              router.push('/account/seller-status')
            }, 2000)
            return
          }

          // Auto-fill modal for withdrawn applications (<90d, <5 withdrawals)
          if (status === 'withdrawn' && withdrawal && application) {
            const withdrawnDate = new Date(withdrawal.withdrawnAt)
            const daysSinceWithdrawal = Math.floor(
              (Date.now() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            const withdrawalCount = withdrawal.withdrawalCount || 0
            if (daysSinceWithdrawal <= 90 && withdrawalCount < 5) {
              setPreviousApplication(application)
              setPreviousWithdrawal(withdrawal)
              setShowPreviousDataModal(true)
            }
          }

          setIsCheckingExisting(false)
        } else {
          setIsCheckingExisting(false)
        }
      } catch (error) {
        console.error('Error checking existing application:', error)
        setIsCheckingExisting(false)
      }
    }

    checkExistingApplication()
  }, [router])

  /**
   * Handler for "Use Previous Data" button — maps the withdrawn application
   * row back onto the CURRENT step shapes (documents are never prefilled).
   */
  const handleUsePreviousData = () => {
    if (!previousApplication) return
    const prev = previousApplication

    // Legacy rows stored 1-based game indexes ('1'-'6'); map both those and
    // real UUIDs onto current game ids, dropping anything unknown.
    const prevGames: string[] = Array.isArray(prev.primary_games) ? prev.primary_games : []
    const primaryGames = prevGames
      .map((id) => {
        if (games.some((g) => g.id === String(id))) return String(id)
        const idx = Number(id)
        if (Number.isInteger(idx) && idx >= 1 && idx <= games.length) return games[idx - 1].id
        return null
      })
      .filter((id): id is string => !!id)

    // Country was stored as free text / full name — keep it when it matches
    // the dataset, otherwise route it through the Other option.
    const storedCountry: string = prev.country || ''
    const countryKnown = COUNTRIES.some((c) => c.name === storedCountry)

    // Legacy payout methods: 'cryptocurrency' → 'crypto'; 'paypal' is no
    // longer offered → default to bank transfer and tell the seller.
    const storedPayout: string = prev.payout_method || ''
    const payoutMethod: Step5FormData['payoutMethod'] =
      storedPayout === 'cryptocurrency' || storedPayout === 'crypto' ? 'crypto' : 'bank_transfer'
    if (storedPayout === 'paypal') {
      toast.info('PayPal payouts are no longer offered — we preselected Bank Transfer instead.')
    }

    const prefilledData: SellerFormData = {
      step1: {
        is18OrOlder: prev.is_18_or_older ?? false,
        sellerType: prev.seller_type === 'business' ? 'business' : 'individual',
        primaryGames,
        otherGames: prev.other_games || '',
        expectedVolume: prev.expected_monthly_volume || undefined,
        referralCode: prev.referral_code || '',
      } as Step1FormData,
      step2: {
        fullLegalName: prev.full_legal_name || '',
        displayName: prev.display_name || '',
        shopName: prev.shop_name || '',
        country: storedCountry ? (countryKnown ? storedCountry : OTHER_COUNTRY) : '',
        countryOther: storedCountry && !countryKnown ? storedCountry : '',
        stateProvince: prev.state_province || '',
        city: prev.city || '',
        phoneNumber: prev.phone_number || '',
        alternateEmail: prev.alternate_email || '',
        companyLegalName: prev.company_legal_name || '',
        businessRegistrationNumber: prev.business_registration_number || '',
        taxIdVat: prev.tax_id_vat || '',
        companyAddress: prev.company_address || '',
        businessType: prev.business_type || undefined,
        yearEstablished: prev.year_established ? String(prev.year_established) : '',
        businessEmail: prev.business_email || '',
        businessPhone: prev.business_phone || '',
      } as Step2FormData,
      step3: undefined, // Documents must be re-uploaded for security
      step4: {
        bio: prev.profile_bio || '',
        businessHours: prev.business_hours || '',
        timezone: prev.timezone || '',
        languagesSpoken: prev.languages_spoken || [],
        discordUsername: prev.discord_username || '',
        twitterHandle: prev.twitter_handle || '',
        twitchChannel: prev.twitch_channel || '',
        youtubeChannel: prev.youtube_channel || '',
        refundPolicy: prev.refund_policy || '',
        deliveryTimeframe: prev.delivery_timeframe || '',
        termsOfService: prev.terms_of_service || '',
      } as Step4FormData,
      step5: {
        payoutMethod,
        accountHolderName: prev.bank_account_holder_name || '',
        bankName: prev.bank_name || '',
        iban: prev.bank_iban || '',
        cryptoWalletAddress: prev.crypto_wallet_address || '',
        taxResidencyCountry: prev.tax_residency_country || '',
        taxForm: 'none',
      } as Step5FormData,
      step6: undefined, // Agreements must be re-accepted
    }

    if (prev.languages_spoken) {
      setSelectedLanguages(prev.languages_spoken)
    }

    setFormData(prefilledData)
    setShowPreviousDataModal(false)
    toast.success('Previous application data loaded! You can edit any field.')
  }

  /**
   * Handler for "Start Fresh" button
   */
  const handleStartFresh = () => {
    setShowPreviousDataModal(false)
    setPreviousApplication(null)
  }

  /**
   * Handles completion of any step
   */
  const handleStepComplete = (
    step: number,
    data: Step1FormData | Step2FormData | Step3FormData | Step4FormData | Step5FormData | Step6FormData
  ) => {
    setFormData((prev) => ({
      ...prev,
      [`step${step}`]: data,
    }))
    if (step < TOTAL_STEPS) {
      setCurrentStep(step + 1)
    }
  }

  /**
   * Jump straight to a step (Edit buttons in the final review).
   */
  const goToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) setCurrentStep(step)
  }

  /**
   * A document finished uploading (or was removed) in Step 3.
   */
  const handleDocChange = (fileType: string, doc: UploadedDoc | null) => {
    setUploadedDocs((prev) => ({
      ...prev,
      [fileType]: doc,
    }))
  }

  /**
   * Handles final submission (Step 6).
   * Files are already in storage — this only verifies + persists metadata.
   */
  const handleFinalSubmit = async (step6Data: Step6FormData) => {
    if (!formData.step1 || !formData.step2) {
      toast.error('Missing required information. Please complete all steps.')
      return
    }

    // Required documents must have ACTUALLY uploaded (storage path present)
    const missingDocs = (['idDocument', 'selfieWithId', 'proofOfAddress'] as const).filter(
      (key) => !uploadedDocs[key]?.path
    )
    if (missingDocs.length > 0) {
      toast.error('Required verification documents are missing. Please upload them in Step 3.')
      setCurrentStep(3)
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
    setLoaderStage('submitting')

    try {
      const result = await submitSellerApplication({
        step1: formData.step1,
        step2: formData.step2,
        step3: formData.step3,
        step4: formData.step4,
        step5: formData.step5,
        step6: step6Data, // Use directly passed data
        uploadedFilePaths: uploadedDocs,
        profilePicturePath: storeImage,
        selectedLanguages,
      })

      if (result.success) {
        setLoaderStage('complete')
        toast.success(
          result.message ||
            'Application submitted successfully! You will receive an email confirmation shortly.'
        )
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
            <p className="text-sm text-text-secondary">Checking your application status...</p>
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
              {/* Content */}
              <div className="relative p-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-lime/20 blur-xl" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-lime">
                      <CheckCircle className="h-8 w-8 text-black" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-center text-2xl font-bold text-white mb-3">Application Found</h2>

                {/* Message */}
                <p className="text-center text-text-secondary mb-6">
                  You already have an application in progress. Redirecting you to your application status page...
                </p>

                {/* Loading Animation */}
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-lime-text" />
                  <span className="text-sm font-medium text-lime-text">Redirecting</span>
                  <ArrowRight className="h-4 w-4 text-lime-text animate-pulse" />
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
              {/* Fees Badge */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link
                  href="/fees"
                  target="_blank"
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-overlay px-3 py-1.5 transition-colors hover:border-border-strong"
                >
                  <Percent className="h-3.5 w-3.5 text-lime-text" />
                  <span className="text-xs font-semibold text-text-secondary">
                    Transparent Per-Category Fees
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-text-tertiary" />
                </Link>
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
                className="text-sm text-text-secondary max-w-xl"
              >
                Join thousands of sellers with fast payouts and clear per-category fees.
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
                { label: 'Transparent Fees', icon: DollarSign },
                { label: 'Instant Listings', icon: Zap },
                { label: 'Fast Payouts', icon: Clock },
                { label: '24/7 Support', icon: Headphones },
              ].map((benefit) => (
                <div
                  key={benefit.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-overlay border border-border-subtle"
                >
                  <benefit.icon className="h-3.5 w-3.5 text-text-secondary" />
                  <span className="text-xs font-medium text-text-secondary">{benefit.label}</span>
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-overlay border border-border-subtle whitespace-nowrap"
            >
              <Rocket className="h-3.5 w-3.5 text-lime-text" />
              <span className="text-xs font-medium text-text-secondary">
                Step <span className="text-lime-text font-semibold">{currentStep}</span>/{TOTAL_STEPS}
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
              games={games}
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
              uploadedDocs={uploadedDocs}
              onDocChange={handleDocChange}
              storeImage={storeImage}
              onStoreImageChange={setStoreImage}
              selectedLanguages={selectedLanguages}
              onLanguagesChange={setSelectedLanguages}
              initialData={{
                step3: formData.step3,
                step4: formData.step4,
              }}
            />
          )}

          {/* Steps 5 & 6: Payout and Review */}
          {(currentStep === 5 || currentStep === 6) && (
            <SellerSteps56
              currentStep={currentStep}
              onStepComplete={handleStepComplete}
              onStepBack={handleStepBack}
              onSubmitApplication={handleFinalSubmit}
              isSubmitting={isSubmitting}
              goToStep={goToStep}
              games={games}
              uploadedDocs={uploadedDocs}
              storeImage={storeImage}
              reviewData={{
                step1: formData.step1,
                step2: formData.step2,
                step4: formData.step4,
                step5: formData.step5,
              }}
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
      {isSubmitting && <SubmissionLoader stage={loaderStage} />}

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
