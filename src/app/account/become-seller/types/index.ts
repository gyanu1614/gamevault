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
} from '../schemas'

// Component Props Types
export interface StepComponentProps {
  currentStep: number
  onNext: (stepNumber: number) => void
  onPrevious: () => void
}

export interface FileUploadBoxProps {
  label: string
  description: string
  fileType: string
  uploadedFile: File | null
  onFileUpload: (fileType: string, file: File | null) => void
  sampleImage?: string
}

export interface ProgressBarProps {
  currentStep: number
  steps: Array<{
    id: number
    name: string
    icon: React.ComponentType<{ className?: string }>
  }>
}

// Shared State Types
export interface UploadedFilesState {
  idDocument: File | null
  selfieWithId: File | null
  proofOfAddress: File | null
  certificateOfIncorporation: File | null
  businessLicense: File | null
  directorId: File | null
  bankStatement: File | null
}
