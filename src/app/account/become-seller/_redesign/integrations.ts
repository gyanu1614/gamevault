/**
 * Redesign integration flags + result types — plain module (NOT a server-action
 * file), so the sync env-gate helpers can be exported. A 'use server' file may
 * only export async functions, so these live here and the async stubs in
 * actions.ts import from this file.
 *
 * Set the env flags + fill the TODO bodies in actions.ts and the wired UI lights
 * up unchanged (Didit KYC video / DocuSeal e-signature).
 */

/**
 * True once Didit KYC is configured: both the API key AND a workflow id are
 * required (sessions cannot be created without a workflow). NEXT_PUBLIC flag
 * doubles as a kill switch.
 */
export function isKycVideoEnabled(): boolean {
  return (
    !!process.env.DIDIT_API_KEY &&
    !!process.env.DIDIT_WORKFLOW_ID &&
    process.env.NEXT_PUBLIC_DIDIT_ENABLED !== 'false'
  )
}

/** True once DocuSeal is configured. Until then the UI uses typed-name accept. */
export function isDocuSealEnabled(): boolean {
  return (
    !!process.env.DOCUSEAL_API_KEY &&
    !!process.env.NEXT_PUBLIC_DOCUSEAL_TEMPLATE_ID
  )
}

export interface StartKycResult {
  /** True when a live session URL was created. */
  enabled: boolean
  /** The hosted Didit session URL to open, or null when unconfigured. */
  url: string | null
  /** Didit session id — the client keeps it to poll the decision. */
  sessionId?: string | null
  message?: string
}

export interface KycCheckResult {
  /** Normalised decision for the wizard. */
  status: 'approved' | 'declined' | 'in_review' | 'pending' | 'error'
  /** Didit's raw status string, for messages/logging. */
  raw?: string
}

/**
 * normalizeDiditStatus — maps Didit's lifecycle status strings down to the
 * app's normalised decision statuses. Single source of truth shared by the
 * poll path (checkKycSession) and the Didit webhook route, so the two intake
 * paths can never disagree on what a raw status means.
 */
export function normalizeDiditStatus(
  raw: string | null | undefined
): Exclude<KycCheckResult['status'], 'error'> {
  if (raw === 'Approved') return 'approved'
  if (raw === 'Declined') return 'declined'
  if (raw === 'In Review' || raw === 'Resubmitted') return 'in_review'
  return 'pending'
}

/** Loose Didit session-id shape check (shared by poll + webhook paths). */
export function isValidDiditSessionId(sessionId: string | null | undefined): boolean {
  return !!sessionId && /^[0-9a-f-]{16,64}$/i.test(sessionId)
}

export interface SignAgreementResult {
  /** True when a DocuSeal embed session is available. */
  enabled: boolean
  /** The DocuSeal embed slug/URL, or null when unconfigured. */
  embedSrc: string | null
  message?: string
}
