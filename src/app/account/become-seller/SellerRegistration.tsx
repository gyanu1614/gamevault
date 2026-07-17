/**
 * SellerRegistration — orchestrator for the "Forest Ledger" seller-application
 * redesign.
 *
 * Flow:
 *   1. On mount, check the seller's application status (getApplicationStatus).
 *      Terminal states (pending / under_review / approved / hard-rejected)
 *      redirect to /account/seller-status. A withdrawn application (<90d, <5
 *      withdrawals) offers a "use previous data" prefill modal. An
 *      info_requested row is EDITABLE, so the seller drops straight into the
 *      stepper with their prior answers prefilled.
 *   2. Otherwise show the INTRO screen first; "Start Application" enters the
 *      5-step split-screen stepper.
 *   3. Each step owns its own react-hook-form slice and validates BEFORE it
 *      advances (validate-before-advance). Steps animate with Framer Motion
 *      (AnimatePresence mode="wait" + directional slide/fade).
 *   4. The final Review & Sign step hands its validated slice up; this component
 *      assembles the full redesign state, runs it through the phase-1 adapter,
 *      and calls the UNCHANGED submitSellerApplication server action.
 *
 * CONTRACT: this component never reshapes the server payload itself — the single
 * seam is toSubmitApplicationData() in _redesign/adapter.ts. The submit payload
 * to submitSellerApplication is byte-for-byte what the legacy wizard produced,
 * plus additive keys the action safely ignores.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import SubmissionLoader from './components/SubmissionLoader'
import SellerFlowLoader from './_redesign/components/SellerFlowLoader'
import PreviousDataModal from './components/PreviousDataModal'
import { submitSellerApplication } from '@/lib/actions/seller-application'
import { getApplicationStatus } from '@/lib/actions/seller-application-status'
import { verifyTurnstileToken } from '@/lib/actions/verify-turnstile'
import { TurnstileWidget } from '@/components/ui/TurnstileWidget'
import { COUNTRIES, OTHER_COUNTRY } from './data/countries'

import {
  SellerAppLayout,
  StepTransition,
  StepAccountGames,
  IntroScreen,
  VideoModal,
  type SectionsByGameId,
  type StepDirection,
} from './_redesign/components'
import { Step2PersonalInfo } from './_redesign/components/steps'
import { StepIdentity } from './_redesign/steps'
import PayoutSetupStep, {
  type PayoutSetupValue,
} from './_redesign/steps/PayoutSetupStep'
import { ReviewSignStep } from './_redesign/screens'
import {
  toSubmitApplicationData,
  type RedesignedSellerState,
} from './_redesign/adapter'
import { TOTAL_REDESIGN_STEPS } from './_redesign/theme'

import type {
  Step1FormData,
  Step2FormData,
  Step3FormData,
  Step5FormData,
  ReviewSignFormData,
  PayoutCurrency,
} from './schemas'
import type { UploadedDoc, UploadedDocsState, WizardGame } from './types'

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
  /** Per-game supported category sections, precomputed server-side. */
  sectionsByGameId: SectionsByGameId
}

export default function SellerRegistration({
  games,
  sectionsByGameId,
}: SellerRegistrationProps) {
  const router = useRouter()

  // ── Flow phase ──────────────────────────────────────────────────────────────
  // 'intro' shows the landing; 'stepper' runs the 5-step application.
  const [phase, setPhase] = useState<'intro' | 'stepper'>('intro')

  // ── Navigation ────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState<StepDirection>('forward')

  // ── Wizard state (redesign shapes) ──────────────────────────────────────────
  const [step1, setStep1] = useState<Step1FormData>()
  const [step2, setStep2] = useState<Step2FormData>()
  const [step3, setStep3] = useState<Step3FormData>()
  const [payout, setPayout] = useState<Step5FormData>()
  const [payoutCurrency, setPayoutCurrency] = useState<PayoutCurrency | null>(null)
  const [review, setReview] = useState<Partial<ReviewSignFormData>>()

  // KYC documents upload IMMEDIATELY on pick (owned here so the required-doc
  // enforcement checks the ACTUAL uploaded path, not a local pick).
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocsState>(EMPTY_DOCS)
  const [selectedLanguages] = useState<string[]>([])

  // ── Submission ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Status gating ─────────────────────────────────────────────────────────
  const [isCheckingExisting, setIsCheckingExisting] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // ── Previous-data prefill (withdrawn applications) ──────────────────────────
  const [showPreviousDataModal, setShowPreviousDataModal] = useState(false)
  const [previousApplication, setPreviousApplication] = useState<any>(null)
  const [previousWithdrawal, setPreviousWithdrawal] = useState<any>(null)

  // ── Video modal (reachable from inside the shell) ───────────────────────────
  const [videoOpen, setVideoOpen] = useState(false)

  // ── Turnstile CAPTCHA ─────────────────────────────────────────────────────
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  /**
   * Check status on mount: redirect terminal states, prefill withdrawn ones,
   * and drop info_requested rows straight into an editable stepper.
   */
  useEffect(() => {
    let cancelled = false
    async function checkExistingApplication() {
      try {
        const result = await getApplicationStatus()
        if (cancelled) return

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
            router.replace('/account/seller-status')
            return
          }

          // info_requested is editable — prefill and go straight into the
          // stepper (skip the intro; the seller is returning to edit).
          if (status === 'info_requested' && application) {
            applyPrefill(application)
            setPhase('stepper')
            setCurrentStep(1)
            setIsCheckingExisting(false)
            return
          }

          // Withdrawn (<90d, <5 withdrawals) → offer the prefill modal.
          if (status === 'withdrawn' && withdrawal && application) {
            const withdrawnDate = new Date(withdrawal.withdrawnAt)
            const daysSinceWithdrawal = Math.floor(
              (Date.now() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24),
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
        if (!cancelled) setIsCheckingExisting(false)
      }
    }

    checkExistingApplication()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  /**
   * Map a stored seller_applications row onto the redesign step shapes.
   * Documents and agreements are never prefilled (must be re-supplied).
   */
  const applyPrefill = (prev: any) => {
    // Legacy rows stored 1-based game indexes ('1'-'6') OR real UUIDs — map both
    // onto current game ids, dropping anything unknown.
    const prevGames: string[] = Array.isArray(prev.primary_games) ? prev.primary_games : []
    const primaryGames = prevGames
      .map((id) => {
        if (games.some((g) => g.id === String(id))) return String(id)
        const idx = Number(id)
        if (Number.isInteger(idx) && idx >= 1 && idx <= games.length) return games[idx - 1].id
        return null
      })
      .filter((id): id is string => !!id)

    // Rebuild per-game category selections from the stored games_categories
    // JSON when present, keeping only games still selected.
    const storedGC: any[] = Array.isArray(prev.games_categories) ? prev.games_categories : []
    const gamesCategories = primaryGames.map((id) => {
      const g = games.find((x) => x.id === id)
      const match = storedGC.find((gc) => String(gc?.gameId) === id)
      return {
        gameId: id,
        gameSlug: g?.slug ?? String(match?.gameSlug ?? ''),
        categorySlugs: Array.isArray(match?.categorySlugs) ? match.categorySlugs : [],
      }
    })

    const storedCountry: string = prev.country || ''
    const countryKnown = COUNTRIES.some((c) => c.name === storedCountry)

    const storedPayout: string = prev.payout_method || ''
    const payoutMethod: Step5FormData['payoutMethod'] =
      storedPayout === 'cryptocurrency' || storedPayout === 'crypto' ? 'crypto' : 'bank_transfer'
    if (storedPayout === 'paypal') {
      toast.info('PayPal payouts are no longer offered — we preselected Bank Transfer instead.')
    }

    setStep1({
      is18OrOlder: prev.is_18_or_older ?? false,
      sellerType: prev.seller_type === 'business' ? 'business' : 'individual',
      primaryGames,
      gamesCategories,
      otherGames: prev.other_games || '',
      expectedVolume: prev.expected_monthly_volume || undefined,
      referralCode: prev.referral_code || '',
    } as Step1FormData)

    setStep2({
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
    } as Step2FormData)

    setPayout({
      payoutMethod,
      accountHolderName: prev.bank_account_holder_name || '',
      bankName: prev.bank_name || '',
      iban: prev.bank_iban || '',
      accountNumber: prev.bank_account_number_encrypted || '',
      cryptoWalletAddress: prev.crypto_wallet_address || '',
      cryptoType: prev.crypto_type || undefined,
      taxResidencyCountry: prev.tax_residency_country || '',
      taxForm: 'none',
    } as Step5FormData)

    const storedCurrency: string = prev.payout_currency || ''
    if (['USD', 'EUR', 'GBP', 'USDT'].includes(storedCurrency)) {
      setPayoutCurrency(storedCurrency as PayoutCurrency)
    }
  }

  const handleUsePreviousData = () => {
    if (!previousApplication) return
    applyPrefill(previousApplication)
    setShowPreviousDataModal(false)
    setPhase('stepper')
    setCurrentStep(1)
    toast.success('Previous application data loaded! You can edit any field.')
  }

  const handleStartFresh = () => {
    setShowPreviousDataModal(false)
    setPreviousApplication(null)
  }

  // ── Step navigation ───────────────────────────────────────────────────────

  const goForward = (next: number) => {
    setDirection('forward')
    setCurrentStep(next)
    scrollTop()
  }

  const goBack = () => {
    if (currentStep <= 1) return
    setDirection('back')
    setCurrentStep((s) => s - 1)
    scrollTop()
  }

  /** Jump to a completed step (the stepper + review "Edit" affordances). */
  const goToStep = (step: number) => {
    if (step < 1 || step > TOTAL_REDESIGN_STEPS) return
    setDirection(step < currentStep ? 'back' : 'forward')
    setCurrentStep(step)
    scrollTop()
  }

  const scrollTop = () => {
    if (typeof document === 'undefined') return
    const pane = document.querySelector('[data-seller-scroll]')
    if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDocChange = (fileType: string, doc: UploadedDoc | null) => {
    setUploadedDocs((prev) => ({ ...prev, [fileType]: doc }))
  }

  // ── Step completion handlers (each step validated its own slice) ────────────

  const handleStep1 = (data: Step1FormData) => {
    setStep1(data)
    goForward(2)
  }

  const handleStep2 = (data: Step2FormData) => {
    setStep2(data)
    goForward(3)
  }

  const handleStep3 = (data: Step3FormData) => {
    setStep3(data)
    goForward(4)
  }

  const handleStep4 = (value: PayoutSetupValue) => {
    setPayout(value.payout)
    setPayoutCurrency(value.payoutCurrency)
    goForward(5)
  }

  /** Final Review & Sign submit → assemble state, adapt, submit. */
  const handleFinalSubmit = async (reviewData: ReviewSignFormData) => {
    setReview(reviewData)

    if (!step1 || !step2) {
      toast.error('Missing required information. Please complete all steps.')
      goToStep(1)
      return
    }

    // Payout step must be completed — without it the adapter would spread
    // undefined and persist a null payout method.
    if (!payout) {
      toast.error('Please complete your payout setup before submitting.')
      goToStep(4)
      return
    }

    // Required documents must have ACTUALLY uploaded (storage path present).
    const missingDocs = (['idDocument', 'selfieWithId', 'proofOfAddress'] as const).filter(
      (key) => !uploadedDocs[key]?.path,
    )
    if (missingDocs.length > 0) {
      toast.error('Required verification documents are missing. Please upload them in the Identity step.')
      goToStep(3)
      return
    }

    // Verify Turnstile CAPTCHA before submitting.
    if (turnstileEnabled) {
      const captcha = await verifyTurnstileToken(turnstileToken)
      if (!captcha.success) {
        toast.error(captcha.error || 'CAPTCHA verification failed. Please try again.')
        setTurnstileToken('')
        return
      }
    }

    setIsSubmitting(true)

    try {
      const state: RedesignedSellerState = {
        step1,
        step2,
        step3,
        payout,
        payoutCurrency,
        review: reviewData,
        uploadedDocs,
        storeImage: null,
        selectedLanguages,
      }
      const payload = toSubmitApplicationData(state)
      const result = await submitSellerApplication(payload)

      if (result.success) {
        // The received/confirmation state lives ON the status page (banner
        // via ?submitted=1) — no second loader stage, no toast+timeout hop.
        router.push('/account/seller-status?submitted=1')
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

  // Full redesign state for the review summary (read-only).
  const reviewState: RedesignedSellerState = useMemo(
    () => ({
      step1,
      step2,
      step3,
      payout,
      payoutCurrency,
      review: undefined,
      uploadedDocs,
      storeImage: null,
      selectedLanguages,
    }),
    [step1, step2, step3, payout, payoutCurrency, uploadedDocs, selectedLanguages],
  )

  // ── Loading / redirect gates ────────────────────────────────────────────────

  if (isCheckingExisting) {
    return <SellerFlowLoader label="Checking your application…" />
  }

  if (isRedirecting) {
    return <SellerFlowLoader label="Taking you to your application status…" />
  }

  // ── Intro landing (before the stepper) ──────────────────────────────────────
  if (phase === 'intro') {
    return (
      <>
        <IntroScreen onStart={() => { setDirection('forward'); setCurrentStep(1); setPhase('stepper') }} />

        {previousApplication && previousWithdrawal && (
          <PreviousDataModal
            isOpen={showPreviousDataModal}
            withdrawnAt={previousWithdrawal.withdrawnAt}
            withdrawalCount={previousWithdrawal.withdrawalCount}
            onUseData={handleUsePreviousData}
            onStartFresh={handleStartFresh}
          />
        )}
      </>
    )
  }

  // ── Stepper ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SellerAppLayout
        currentStep={currentStep}
        onStepClick={goToStep}
        onWatchVideo={() => setVideoOpen(true)}
      >
        <AnimatePresence mode="wait" initial={false}>
          {currentStep === 1 && (
            <StepTransition key={1} stepKey={1} direction={direction}>
              <StepAccountGames
                games={games}
                sectionsByGameId={sectionsByGameId}
                initialData={step1}
                onComplete={handleStep1}
              />
            </StepTransition>
          )}

          {currentStep === 2 && (
            <StepTransition key={2} stepKey={2} direction={direction}>
              <Step2PersonalInfo
                sellerType={step1?.sellerType}
                initialData={step2}
                onSubmit={handleStep2}
                onBack={goBack}
              />
            </StepTransition>
          )}

          {currentStep === 3 && (
            <StepTransition key={3} stepKey={3} direction={direction}>
              <StepIdentity
                uploadedDocs={uploadedDocs}
                onDocChange={handleDocChange}
                onContinue={handleStep3}
                onBack={goBack}
                sellerType={step1?.sellerType}
              />
            </StepTransition>
          )}

          {currentStep === 4 && (
            <StepTransition key={4} stepKey={4} direction={direction}>
              <PayoutSetupStep
                defaultPayout={payout}
                defaultPayoutCurrency={payoutCurrency}
                onValidSubmit={handleStep4}
                onBack={goBack}
              />
            </StepTransition>
          )}

          {currentStep === 5 && (
            <StepTransition key={5} stepKey={5} direction={direction}>
              <div>
                <ReviewSignStep
                  state={reviewState}
                  games={games}
                  initialData={review}
                  goToStep={goToStep}
                  onBack={goBack}
                  onSubmit={handleFinalSubmit}
                  isSubmitting={isSubmitting}
                />

                {turnstileEnabled && (
                  <div className="mt-6">
                    <TurnstileWidget
                      onToken={setTurnstileToken}
                      onExpire={() => setTurnstileToken('')}
                      className="flex justify-center"
                    />
                  </div>
                )}
              </div>
            </StepTransition>
          )}
        </AnimatePresence>
      </SellerAppLayout>

      {/* Video modal — reachable from the shell's "Watch How It Works" button. */}
      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />

      {/* Submission loader overlay. */}
      {isSubmitting && <SubmissionLoader />}
    </>
  )
}
