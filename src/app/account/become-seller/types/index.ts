/**
 * Seller Registration TypeScript Types
 *
 * Type definitions for the registration process
 */

// Re-export form data types from schemas
export type {
  Step1FormData,
  Step2FormData,
  Step3FormData,
  Step4FormData,
  Step5FormData,
  Step6FormData,
  UploadedDoc,
} from '../schemas'

import type { UploadedDoc } from '../schemas'

/** Keys of the KYC documents collected in Step 3. */
export type KycDocKey =
  | 'idDocument'
  | 'selfieWithId'
  | 'proofOfAddress'
  | 'certificateOfIncorporation'
  | 'businessLicense'
  | 'directorId'
  | 'bankStatement'

/** Shared state — documents that finished uploading to storage. */
export type UploadedDocsState = Record<KycDocKey, UploadedDoc | null>

/** Client-safe shape of a games-table row (fetched server-side in page.tsx). */
export interface WizardGame {
  id: string
  name: string
  slug: string
  emoji: string | null
  image_url: string | null
}

export interface ProgressBarProps {
  currentStep: number
  steps: Array<{
    id: number
    name: string
    icon: React.ComponentType<{ className?: string }>
  }>
}
