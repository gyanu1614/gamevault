/**
 * Seller Verification Utility
 *
 * Calculates verification status (X/4) for seller applications based on uploaded documents
 */

export interface SellerDocument {
  document_type: string
  verified?: boolean
}

export interface VerificationStatus {
  total: number
  verified: number
  percentage: number
  identity_verified: boolean
  address_verified: boolean
  business_verified: boolean
  tax_verified: boolean
}

/**
 * Calculate verification status based on uploaded documents
 *
 * Verification checkpoints:
 * 1. Identity (ID + Selfie) - requires: id_front OR id_back OR selfie_with_id
 * 2. Address - requires: proof_of_address
 * 3. Business - requires: certificate_of_incorporation OR business_license OR director_id
 * 4. Tax - requires: w9_form OR w8ben_form OR bank_statement
 */
export function calculateVerificationStatus(
  documents: SellerDocument[] | null | undefined,
  application?: {
    identity_verified?: boolean
    address_verified?: boolean
    business_verified?: boolean
    tax_verified?: boolean
  }
): VerificationStatus {
  // If application has manual verification flags set by admin, use those
  if (application) {
    const manual = {
      identity_verified: application.identity_verified || false,
      address_verified: application.address_verified || false,
      business_verified: application.business_verified || false,
      tax_verified: application.tax_verified || false,
    }

    const manualVerified = [
      manual.identity_verified,
      manual.address_verified,
      manual.business_verified,
      manual.tax_verified
    ].filter(Boolean).length

    if (manualVerified > 0) {
      return {
        total: 4,
        verified: manualVerified,
        percentage: (manualVerified / 4) * 100,
        ...manual
      }
    }
  }

  // Otherwise, calculate based on documents
  const docTypes = (documents || []).map(d => d.document_type)

  // 1. Identity - needs ID document AND selfie
  const hasIdDocument = docTypes.some(t => ['id_front', 'id_back'].includes(t))
  const hasSelfie = docTypes.includes('selfie_with_id')
  const identity_verified = hasIdDocument && hasSelfie

  // 2. Address
  const address_verified = docTypes.includes('proof_of_address')

  // 3. Business - any business document
  const business_verified = docTypes.some(t =>
    ['certificate_of_incorporation', 'business_license', 'director_id'].includes(t)
  )

  // 4. Tax - any tax document
  const tax_verified = docTypes.some(t =>
    ['w9_form', 'w8ben_form', 'bank_statement'].includes(t)
  )

  const verified = [identity_verified, address_verified, business_verified, tax_verified]
    .filter(Boolean).length

  return {
    total: 4,
    verified,
    percentage: (verified / 4) * 100,
    identity_verified,
    address_verified,
    business_verified,
    tax_verified
  }
}

/**
 * Get verification status color based on percentage
 */
export function getVerificationColor(percentage: number): {
  bg: string
  text: string
  border: string
  progressBg: string
} {
  if (percentage === 100) {
    return {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      border: 'border-green-500/20',
      progressBg: 'bg-green-500'
    }
  } else if (percentage >= 50) {
    return {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      border: 'border-yellow-500/20',
      progressBg: 'bg-yellow-500'
    }
  } else {
    return {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
      progressBg: 'bg-red-500'
    }
  }
}

/**
 * Get verification status label
 */
export function getVerificationLabel(verified: number, total: number): string {
  if (verified === 0) return 'Not Started'
  if (verified === total) return 'Complete'
  return 'In Progress'
}
