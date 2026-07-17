/**
 * Redesign → server-action adapter.
 *
 * The "Forest Ledger" redesign uses a leaner, consolidated form state. The
 * existing `submitSellerApplication(data: SubmitApplicationData)` server action
 * is UNCHANGED — this adapter is the single seam that maps the new shape back
 * onto the exact payload it already receives:
 *
 *   { step1, step2, step3?, step4?, step5?, step6?, uploadedFilePaths?,
 *     profilePicturePath?, selectedLanguages? }
 *
 * Nothing here calls the server; it only reshapes state. The five new columns
 * (games_categories, selling_experience, payout_currency, seller_signature,
 * seller_signed_at) ride into the payload via step1 / step5 / step6 fields the
 * action already reads — see notes inline. Because the action reads its columns
 * from those step objects, adding fields to them is safe and additive.
 */

import type {
  Step1FormData,
  Step2FormData,
  Step3FormData,
  Step4FormData,
  Step5FormData,
  Step6FormData,
  UploadedDoc,
  GameCategorySelection,
  ReviewSignFormData,
  PayoutCurrency,
} from '../schemas'
import type { UploadedDocsState } from '../types'

/** Metadata shape the server action stores per uploaded file. */
export interface UploadedFileMetadata {
  path: string
  name: string
  size: number
  type: string
}

/**
 * The consolidated state the redesigned wizard holds. Screen agents write into
 * this; the adapter turns it into the legacy SubmitApplicationData. Everything
 * optional here mirrors "step not reached yet" so partial state adapts cleanly.
 */
export interface RedesignedSellerState {
  /** Step 1 — Account & Games (already the same shape, now incl. gamesCategories). */
  step1?: Step1FormData
  /** Step 2 — Personal Info (same shape as legacy step2). */
  step2?: Step2FormData
  /** Step 3 — Identity / KYC. Documents live in `uploadedDocs`, not here. */
  step3?: Step3FormData
  /** Step 4 — Payout Setup (same shape as legacy step5). */
  payout?: Step5FormData
  /** Optional payout currency preference (Payout Setup). */
  payoutCurrency?: PayoutCurrency | null
  /** Step 5 — Review & Sign: consolidated consent + selling experience + signature. */
  review?: ReviewSignFormData

  /** KYC documents that finished uploading (Step 3, immediate upload). */
  uploadedDocs: UploadedDocsState
  /** Store image / logo uploaded to the profile-pictures bucket. */
  storeImage?: UploadedDoc | null
  /** Languages selected (kept top-level to match the legacy payload). */
  selectedLanguages?: string[]
}

/** The exact shape `submitSellerApplication` expects. Re-declared locally so
 *  the adapter's output is type-checked against the contract without importing
 *  the server module into client code. */
export interface SubmitApplicationData {
  step1: Step1FormData
  step2: Step2FormData
  step3?: Step3FormData
  step4?: Step4FormData
  step5?: Step5FormData
  step6?: Step6FormData
  uploadedFilePaths?: Record<string, UploadedFileMetadata | null>
  profilePicturePath?: UploadedFileMetadata | null
  selectedLanguages?: string[]
}

/**
 * Build the games_categories JSONB payload from Step 1. Kept as a helper so the
 * screen agents (and the review summary) can reuse the exact serialization.
 */
export function toGamesCategories(
  step1: Step1FormData | undefined,
): GameCategorySelection[] {
  return step1?.gamesCategories ?? []
}

/**
 * Map the consolidated Review & Sign consent to the six legacy accepted_*
 * booleans + accuracy confirm. The single `consolidatedConsent` checkbox now
 * legally covers ToS, Privacy, Fee Schedule (accepted_commission_structure),
 * Data Processing, Anti-Fraud, and accuracy — so they're all set together. The
 * Seller Agency Agreement acceptance comes from having signed (signatureName +
 * signedAt present).
 */
export function toStep6(review: ReviewSignFormData | undefined): Step6FormData {
  const consent = review?.consolidatedConsent === true
  const signed = !!review?.signatureName && !!review?.signedAt
  return {
    // Signed the Seller Agency Agreement (typed-name e-signature / DocuSeal).
    acceptedSellerAgreement: signed,
    // All folded into the single consolidated consent line.
    acceptedPrivacyPolicy: consent,
    acceptedAntiFraudPolicy: consent,
    acceptedFeeSchedule: consent,
    acceptedDataProcessing: consent,
    informationAccurate: consent,
    // Legacy-only field the old step6 schema carried; kept true so any code
    // reading it stays satisfied. Folded into the consolidated consent.
    understandConsequences: consent,
  }
}

/**
 * Fold the redesign's new step-1 fields (per-game categories) into a step1
 * object shaped exactly like the legacy Step1FormData. The server action reads
 * `games_categories` off step1, so it's carried there.
 */
export function toStep1(step1: Step1FormData | undefined): Step1FormData & {
  gamesCategories: GameCategorySelection[]
} {
  return {
    ...(step1 as Step1FormData),
    gamesCategories: toGamesCategories(step1),
  }
}

/**
 * Fold selling experience + payout currency + signature into a step objects so
 * the server action can persist the new columns without a signature change.
 *
 *   selling_experience  ← review.sellingExperience (required, a few lines)
 *   payout_currency     ← payoutCurrency
 *   seller_signature    ← review.signatureName
 *   seller_signed_at    ← review.signedAt
 *
 * These are attached to step5 (payout) and step6 (agreements) which the action
 * already receives. The server action is extended (separately, by the wiring
 * agent) to read these keys; the KEY NAMES here are the contract.
 */
export function toStep5(
  payout: Step5FormData | undefined,
  payoutCurrency: PayoutCurrency | null | undefined,
): Step5FormData & { payoutCurrency: string | null } {
  return {
    ...(payout as Step5FormData),
    // Remove the tax-form dropdown value entirely — the redesign drops it.
    taxForm: 'none',
    payoutCurrency: payoutCurrency ?? null,
  }
}

/**
 * The main adapter. Returns the EXACT SubmitApplicationData the untouched
 * server action expects. Throws-nothing: callers should have validated each
 * slice with its zod schema before calling (same as the legacy wizard did).
 */
export function toSubmitApplicationData(
  state: RedesignedSellerState,
): SubmitApplicationData {
  const step1 = toStep1(state.step1)
  const step5 = toStep5(state.payout, state.payoutCurrency)
  const step6 = toStep6(state.review)

  // Selling experience + signature travel on the objects the action reads.
  const sellingExperience = state.review?.sellingExperience?.trim() || null

  const step6WithSignature = {
    ...step6,
    // New columns the action persists (contract keys — do not rename):
    sellerSignature: state.review?.signatureName ?? null,
    sellerSignedAt: state.review?.signedAt ?? null,
    marketingConsent: state.review?.marketingConsent ?? false,
    sellingExperience,
  }

  return {
    step1,
    step2: state.step2 as Step2FormData,
    step3: state.step3,
    // No separate profile step in the redesign — step4 stays undefined so the
    // action's profile_bio/social columns simply write null. selling_experience
    // rides on step6 instead of profile_bio.
    step4: undefined,
    step5,
    step6: step6WithSignature,
    uploadedFilePaths: state.uploadedDocs,
    profilePicturePath: state.storeImage ?? null,
    selectedLanguages: state.selectedLanguages ?? [],
  }
}
