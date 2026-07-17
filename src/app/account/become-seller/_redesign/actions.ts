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

import { createClient } from '@/lib/supabase/server'
import {
  isKycVideoEnabled,
  isDocuSealEnabled,
  type StartKycResult,
  type KycCheckResult,
  type SignAgreementResult,
} from './integrations'

const DIDIT_BASE = 'https://verification.didit.me/v3'

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  )
}

/**
 * startKycSession — creates a Didit hosted verification session (govt ID +
 * liveness + face match per the configured workflow) for the signed-in
 * applicant and returns its hosted URL + session id. Falls back to
 * { enabled:false } when unconfigured so the Identity step keeps the manual
 * govt-ID + selfie upload path.
 */
export async function startKycSession(): Promise<StartKycResult> {
  if (!isKycVideoEnabled()) {
    return {
      enabled: false,
      url: null,
      message: 'Video verification is coming soon — please upload your ID and selfie for now.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { enabled: false, url: null, message: 'Please sign in to verify your identity.' }
  }

  try {
    const res = await fetch(`${DIDIT_BASE}/session/`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.DIDIT_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: process.env.DIDIT_WORKFLOW_ID,
        // Stable identifier → Didit-side duplicate detection per applicant.
        vendor_data: user.id,
        // The hosted flow runs in a NEW TAB (wizard state lives in the
        // original tab) — the callback page just tells them to come back.
        callback: `${appBaseUrl()}/kyc/complete`,
        metadata: { purpose: 'seller_application' },
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[Didit] create session failed:', res.status, body.slice(0, 300))
      return {
        enabled: false,
        url: null,
        message: 'Could not start video verification right now — please upload your ID and selfie instead.',
      }
    }

    const session = (await res.json()) as { session_id: string; url: string }
    return { enabled: true, url: session.url, sessionId: session.session_id }
  } catch (e) {
    console.error('[Didit] create session error:', e)
    return {
      enabled: false,
      url: null,
      message: 'Could not start video verification right now — please upload your ID and selfie instead.',
    }
  }
}

/**
 * checkKycSession — polls the Didit decision for a session the applicant
 * started. Called from the Identity step's "Check Status" button after they
 * return from the hosted flow. Normalises Didit's lifecycle statuses down to
 * what the wizard needs.
 */
export async function checkKycSession(sessionId: string): Promise<KycCheckResult> {
  if (!isKycVideoEnabled()) return { status: 'error' }
  if (!/^[0-9a-f-]{16,64}$/i.test(sessionId)) return { status: 'error' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'error' }

  try {
    const res = await fetch(`${DIDIT_BASE}/session/${sessionId}/decision/`, {
      headers: { 'x-api-key': process.env.DIDIT_API_KEY! },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('[Didit] decision fetch failed:', res.status)
      return { status: 'error' }
    }
    const decision = (await res.json()) as { status?: string; vendor_data?: string }

    // The session must belong to THIS applicant — vendor_data carries the
    // user id we set at creation. Prevents pasting someone else's session.
    if (decision.vendor_data && decision.vendor_data !== user.id) {
      return { status: 'error' }
    }

    const raw = decision.status ?? 'Unknown'
    if (raw === 'Approved') return { status: 'approved', raw }
    if (raw === 'Declined') return { status: 'declined', raw }
    if (raw === 'In Review' || raw === 'Resubmitted') return { status: 'in_review', raw }
    return { status: 'pending', raw }
  } catch (e) {
    console.error('[Didit] decision error:', e)
    return { status: 'error' }
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
