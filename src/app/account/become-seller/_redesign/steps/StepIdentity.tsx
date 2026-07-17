/**
 * StepIdentity — Step 3 of the "Forest Ledger" seller-application redesign.
 *
 * Identity (KYC). Two paths, one goal — prove the seller is a real person so
 * buyers can trust every listing:
 *
 *   1. VERIFY WITH VIDEO (Recommended) — the prominent affordance. Calls the
 *      `startKycSession()` server-action STUB. Today the stub returns
 *      { enabled:false, url:null } (Didit isn't wired yet), so we show a
 *      graceful "coming soon" state and steer the seller to the manual path.
 *      When Didit is configured the same button opens `result.url` — the data
 *      slot (`kycSessionUrl`) is already wired, so it drops in without a
 *      redesign.
 *
 *   2. MANUAL UPLOAD — the working fallback: government ID + selfie (+ proof of
 *      address, and business docs when applicable). Files upload immediately via
 *      `useImmediateUpload`; the parent owns the uploaded-docs state. Continue is
 *      gated by `step3Schema.safeParse(uploadedDocs)`, so a required document
 *      passes ONLY when its storage `path` exists (an actual completed upload,
 *      never a local file pick) — the existing enforcement fix is preserved.
 *
 * This screen is presentational + local validation only. It does NOT touch the
 * server action or the schemas; the orchestrator owns navigation and the
 * uploaded-docs state, exactly like the legacy wizard.
 */

'use client'

import { useState } from 'react'
import { ShieldCheck, Video, Sparkles, Lock, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

import { step3Schema, type Step3FormData } from '../../schemas'
import type { KycDocKey, UploadedDocsState, UploadedDoc } from '../../types'
import { startKycSession } from '../actions'
import { PALETTE } from '../theme'
import { StepHeader } from '../components'
import KycUploadRow from './KycUploadRow'

interface StepIdentityProps {
  /** Uploaded KYC documents — owned by the orchestrator (immediate upload). */
  uploadedDocs: UploadedDocsState
  onDocChange: (fileType: string, doc: UploadedDoc | null) => void
  /** Advance — receives the validated Step 3 data. */
  onContinue: (data: Step3FormData) => void
  onBack?: () => void
  sellerType?: 'individual' | 'business'
}

/** Video-verification affordance state — the wired data slot for Didit. */
interface KycVideoState {
  status: 'idle' | 'starting' | 'ready' | 'unavailable'
  /** The hosted verification session URL, once a session exists. */
  kycSessionUrl: string | null
  message: string | null
}

export default function StepIdentity({
  uploadedDocs,
  onDocChange,
  onContinue,
  onBack,
  sellerType,
}: StepIdentityProps) {
  // Step 3 has no free-form inputs — validation runs against the ACTUALLY
  // uploaded documents (each carries a storage path), so a required doc can
  // never pass on a local pick.
  const [errors, setErrors] = useState<Partial<Record<KycDocKey, string>>>({})

  const [video, setVideo] = useState<KycVideoState>({
    status: 'idle',
    kycSessionUrl: null,
    message: null,
  })

  const handleDocChange = (fileType: string, doc: UploadedDoc | null) => {
    setErrors((prev) => ({ ...prev, [fileType]: undefined }))
    onDocChange(fileType, doc)
  }

  const handleVerifyWithVideo = async () => {
    setVideo((v) => ({ ...v, status: 'starting', message: null }))
    try {
      const result = await startKycSession()
      if (result.enabled && result.url) {
        // Didit is live — hand off to the hosted session.
        setVideo({ status: 'ready', kycSessionUrl: result.url, message: result.message ?? null })
        window.open(result.url, '_blank', 'noopener,noreferrer')
        return
      }
      // Unconfigured stub → graceful fallback to the manual upload path below.
      setVideo({
        status: 'unavailable',
        kycSessionUrl: null,
        message:
          result.message ??
          'Video verification is coming soon — please upload your ID and selfie for now.',
      })
    } catch {
      setVideo({
        status: 'unavailable',
        kycSessionUrl: null,
        message: 'Could not start video verification. Please upload your ID and selfie for now.',
      })
    }
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = step3Schema.safeParse(uploadedDocs)
    if (!parsed.success) {
      const errs: Partial<Record<KycDocKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as KycDocKey
        if (key && !errs[key]) errs[key] = issue.message
      }
      setErrors(errs)
      return
    }
    setErrors({})
    onContinue(parsed.data)
  }

  const starting = video.status === 'starting'

  return (
    <form onSubmit={handleContinue}>
      <StepHeader
        heading="Identity"
        explainer="A quick identity check is what lets buyers trust every seller on the marketplace."
        icon={ShieldCheck}
      />

      {/* ── Verify With Video (Recommended) — the prominent affordance ──────── */}
      <section
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
        style={{
          backgroundColor: PALETTE.forest,
          boxShadow: '0 1px 2px rgba(20,67,42,0.12)',
        }}
      >
        {/* Recommended pill */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: PALETTE.lime, color: PALETTE.forest3 }}
        >
          <Sparkles className="h-3 w-3" />
          Recommended
        </span>

        <div className="mt-3 flex items-start gap-3.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
          >
            <Video className="h-5 w-5" style={{ color: '#FFFFFF' }} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold" style={{ color: '#FFFFFF' }}>
              Verify With Video
            </h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
              The fastest way to get approved. Confirm your identity in a short
              guided video check — most sellers finish in under two minutes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleVerifyWithVideo}
          disabled={starting}
          className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          style={{ backgroundColor: PALETTE.paper, color: PALETTE.forest }}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              Verify With Video
            </>
          )}
        </button>

        {/* Unconfigured / graceful state */}
        {video.status === 'unavailable' && video.message && (
          <p
            className="mt-3 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }}
          >
            {video.message}
          </p>
        )}
        {video.status === 'ready' && (
          <p
            className="mt-3 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }}
          >
            Verification opened in a new tab. Finish there, then return here to
            continue.
          </p>
        )}
      </section>

      {/* Divider — "or upload manually" */}
      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1" style={{ backgroundColor: PALETTE.line }} />
        <span className="text-xs font-medium" style={{ color: PALETTE.ink2 }}>
          Or Upload Your Documents
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: PALETTE.line }} />
      </div>

      {/* ── Manual upload path (working fallback) ──────────────────────────── */}
      <div className="space-y-4">
        <KycUploadRow
          label="Government-Issued ID"
          description="Passport, national ID, or driver's license — the photo page, in full."
          fileType="idDocument"
          doc={uploadedDocs.idDocument}
          onDocChange={handleDocChange}
          required
          error={errors.idDocument}
        />

        <KycUploadRow
          label="Selfie With ID"
          description="A selfie holding your ID next to your face, with today's date on a note."
          fileType="selfieWithId"
          doc={uploadedDocs.selfieWithId}
          onDocChange={handleDocChange}
          required
          error={errors.selfieWithId}
        />

        <KycUploadRow
          label="Proof Of Address"
          description="Utility bill, bank statement, or government letter — under three months old."
          fileType="proofOfAddress"
          doc={uploadedDocs.proofOfAddress}
          onDocChange={handleDocChange}
          required
          error={errors.proofOfAddress}
        />

        {sellerType === 'business' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PALETTE.lime }} />
              <h4 className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
                Business Documents
              </h4>
            </div>

            <KycUploadRow
              label="Certificate Of Incorporation"
              description="Your official company registration document."
              fileType="certificateOfIncorporation"
              doc={uploadedDocs.certificateOfIncorporation}
              onDocChange={handleDocChange}
            />
            <KycUploadRow
              label="Business License"
              description="Your current business operating license."
              fileType="businessLicense"
              doc={uploadedDocs.businessLicense}
              onDocChange={handleDocChange}
            />
            <KycUploadRow
              label="Director / Owner ID"
              description="ID for the company director or owner."
              fileType="directorId"
              doc={uploadedDocs.directorId}
              onDocChange={handleDocChange}
            />
            <KycUploadRow
              label="Business Bank Statement"
              description="A recent statement in the company name."
              fileType="bankStatement"
              doc={uploadedDocs.bankStatement}
              onDocChange={handleDocChange}
            />
          </div>
        )}
      </div>

      {/* Security reassurance */}
      <div
        className="mt-5 flex items-start gap-2.5 rounded-xl border p-3.5"
        style={{ borderColor: PALETTE.line, backgroundColor: 'rgba(20,67,42,0.03)' }}
      >
        <Lock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: PALETTE.forest2 }} />
        <p className="text-xs leading-relaxed" style={{ color: PALETTE.ink2 }}>
          Every document is encrypted, used only to verify you, and auto-deleted
          90 days after your check clears. We never share it.
        </p>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]"
          style={{ borderColor: PALETTE.line, color: PALETTE.forest }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="submit"
          className="group inline-flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: PALETTE.forest }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${PALETTE.lime}`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </form>
  )
}
