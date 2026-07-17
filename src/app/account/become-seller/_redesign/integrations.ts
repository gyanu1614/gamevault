/**
 * Redesign integration flags + result types — plain module (NOT a server-action
 * file), so the sync env-gate helpers can be exported. A 'use server' file may
 * only export async functions, so these live here and the async stubs in
 * actions.ts import from this file.
 *
 * Set the env flags + fill the TODO bodies in actions.ts and the wired UI lights
 * up unchanged (Didit KYC video / DocuSeal e-signature).
 */

/** True once Didit KYC is configured. Until then the UI uses the upload path. */
export function isKycVideoEnabled(): boolean {
  return !!process.env.DIDIT_API_KEY && !!process.env.NEXT_PUBLIC_DIDIT_ENABLED
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
  message?: string
}

export interface SignAgreementResult {
  /** True when a DocuSeal embed session is available. */
  enabled: boolean
  /** The DocuSeal embed slug/URL, or null when unconfigured. */
  embedSrc: string | null
  message?: string
}
