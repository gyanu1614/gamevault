/**
 * Seller Verification Utility
 *
 * Scores a seller application against the checks that actually APPLY to it
 * (commercial-agent model):
 *
 *   - Identity      — always applicable. Passed by an approved Didit video
 *                     session (evidence row), by manual uploads (govt ID +
 *                     selfie), or by the admin's identity_verified flag.
 *   - Address Proof — always applicable (proof_of_address upload or the
 *                     admin's address_verified flag).
 *   - Business      — applicable ONLY when seller_type === 'business'
 *                     (incorporation cert / business license / director ID,
 *                     or the admin's business_verified flag).
 *
 * Tax is intentionally NOT a check — the platform operates as the seller's
 * commercial agent, so tax forms don't gate an application. This replaces
 * the old fixed X/4 scoring that showed individuals stuck at 2/4 forever.
 *
 * Plain TS — safe from client components and server actions.
 */

export interface SellerDocument {
  document_type: string
  file_path?: string | null
  file_name?: string | null
  verified?: boolean
  uploaded_at?: string
}

export type VerificationCheckKey = 'identity' | 'address' | 'business'

export interface VerificationCheck {
  key: VerificationCheckKey
  /** Title Case display label. */
  label: string
  /** Check passed. Always false when not applicable. */
  ok: boolean
  /** Whether this check counts for this application (business ⇒ business sellers only). */
  applicable: boolean
  /** Identity only: passed via an approved Didit video session. */
  viaDidit?: boolean
}

export interface VerificationStatus {
  /** Passed count among APPLICABLE checks. */
  verified: number
  /** APPLICABLE check count (2 for individual, 3 for business). */
  total: number
  /** verified/total as 0–100 (100 when total is 0). */
  percentage: number
  /** verified === total. */
  complete: boolean
  /** Every check, including non-applicable ones (render those as N/A). */
  checks: VerificationCheck[]
  /** Identity was satisfied by an approved Didit video session. */
  identityViaDidit: boolean
}

// ─── Didit evidence detection ────────────────────────────────────────────────
//
// The become-seller wizard stores an approved Didit session alongside the
// KYC uploads as a synthetic seller_kyc_documents row:
//   document_type = 'other'
//   file_path     = 'didit:<sessionId>'
//   file_name     = 'Didit Video Verification (Approved)'

export const DIDIT_EVIDENCE_PREFIX = 'didit:'

export function isDiditEvidence(doc: SellerDocument | null | undefined): boolean {
  return !!doc?.file_path && doc.file_path.startsWith(DIDIT_EVIDENCE_PREFIX)
}

/** First Didit evidence row among the application's documents, if any. */
export function findDiditEvidence<T extends SellerDocument>(
  documents: T[] | null | undefined
): T | null {
  return documents?.find((d) => isDiditEvidence(d)) ?? null
}

/** Extract the Didit session id from an evidence file_path ('didit:<id>'). */
export function diditSessionIdFromPath(
  filePath: string | null | undefined
): string | null {
  if (!filePath || !filePath.startsWith(DIDIT_EVIDENCE_PREFIX)) return null
  const id = filePath.slice(DIDIT_EVIDENCE_PREFIX.length).trim()
  return id || null
}

/** Didit business dashboard deep-link for a session. */
export function diditSessionUrl(sessionId: string): string {
  return `https://business.didit.me/sessions/${sessionId}`
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface VerificationApplicationContext {
  /** 'individual' | 'business' — gates the Business check. */
  seller_type?: string | null
  /** Admin-set flags (OR'd with document evidence, never overriding it down). */
  identity_verified?: boolean | null
  address_verified?: boolean | null
  business_verified?: boolean | null
}

/**
 * Calculate verification status from the uploaded documents plus the
 * application context. Only applicable checks count toward verified/total;
 * non-applicable checks are still returned (applicable: false) so the UI
 * can render them as N/A.
 */
export function calculateVerificationStatus(
  documents: SellerDocument[] | null | undefined,
  application?: VerificationApplicationContext
): VerificationStatus {
  const docs = documents || []
  const docTypes = docs.map((d) => d.document_type)

  // Identity — Didit video verification, or manual ID + selfie uploads,
  // or the admin flag.
  const diditEvidence = findDiditEvidence(docs)
  const identityViaDidit = !!diditEvidence
  const hasIdDocument = docTypes.some((t) => ['id_front', 'id_back'].includes(t))
  const hasSelfie = docTypes.includes('selfie_with_id')
  const identityOk =
    identityViaDidit || !!application?.identity_verified || (hasIdDocument && hasSelfie)

  // Address Proof
  const addressOk =
    !!application?.address_verified || docTypes.includes('proof_of_address')

  // Business — only counted for business sellers.
  const businessApplicable = application?.seller_type === 'business'
  const hasBusinessDoc = docTypes.some((t) =>
    ['certificate_of_incorporation', 'business_license', 'director_id'].includes(t)
  )
  const businessOk =
    businessApplicable && (!!application?.business_verified || hasBusinessDoc)

  const checks: VerificationCheck[] = [
    {
      key: 'identity',
      label: 'Identity',
      ok: identityOk,
      applicable: true,
      viaDidit: identityViaDidit,
    },
    { key: 'address', label: 'Address Proof', ok: addressOk, applicable: true },
    { key: 'business', label: 'Business', ok: businessOk, applicable: businessApplicable },
  ]

  const applicableChecks = checks.filter((c) => c.applicable)
  const verified = applicableChecks.filter((c) => c.ok).length
  const total = applicableChecks.length
  const percentage = total === 0 ? 100 : Math.round((verified / total) * 100)

  return {
    verified,
    total,
    percentage,
    complete: verified === total,
    checks,
    identityViaDidit,
  }
}

// ─── Presentation helpers ────────────────────────────────────────────────────

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
