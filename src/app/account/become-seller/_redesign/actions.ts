/**
 * Redesign server-action STUBS — env-gated placeholders that reserve the data
 * slots for Didit KYC (video verification) and DocuSeal e-signature so the real
 * integrations drop in later WITHOUT a redesign.
 *
 * Neither performs a real external call yet. Both are safe no-ops that return a
 * typed result the UI already knows how to render (unconfigured → graceful
 * fallback). The env flags (in ./integrations) are the switch: set them + fill
 * in the TODO bodies and the wired UI lights up unchanged.
 *
 * A 'use server' file may ONLY export async functions, so the sync env-gate
 * helpers and the result types live in ./integrations (a plain module).
 */

'use server'

import {
  isKycVideoEnabled,
  isDocuSealEnabled,
  type StartKycResult,
  type SignAgreementResult,
} from './integrations'

/**
 * startKycSession — STUB. When Didit is configured this creates a verification
 * session and returns its hosted URL. Until then it returns { enabled:false }
 * so the Identity step falls back to the working govt-ID + selfie upload path.
 */
export async function startKycSession(): Promise<StartKycResult> {
  if (!isKycVideoEnabled()) {
    return {
      enabled: false,
      url: null,
      message: 'Video verification is coming soon — please upload your ID and selfie for now.',
    }
  }

  // TODO(didit): create a real session and return session.url.
  //   const res = await fetch('https://verification.didit.me/v1/session', { ... })
  //   return { enabled: true, url: (await res.json()).url }
  return {
    enabled: false,
    url: null,
    message: 'Video verification is not yet available.',
  }
}

/**
 * signSellerAgreement — STUB. When DocuSeal is configured this returns the embed
 * source for the @docuseal/react DocusealForm. Until then it returns
 * { enabled:false } so the Review step falls back to the typed-name click-accept
 * that still records name + date + timestamp into the signature columns.
 */
export async function signSellerAgreement(): Promise<SignAgreementResult> {
  if (!isDocuSealEnabled()) {
    return {
      enabled: false,
      embedSrc: null,
      message: 'Sign by typing your full legal name below — this records a legally binding acceptance.',
    }
  }

  // TODO(docuseal): create/fetch a submission and return its embed src.
  return {
    enabled: false,
    embedSrc: null,
    message: 'E-signature embed is not yet available.',
  }
}
