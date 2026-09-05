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
 *   2. MANUAL UPLOAD — the working fallback: government ID + selfie, hidden
 *      behind a quiet "Can't Use Video?" toggle (`manualMode`) so the video
 *      path stays front and center. Proof of address (and business docs when
 *      applicable) is always visible — it's required on BOTH paths. If Continue
 *      fails validation on the hidden ID/selfie rows, `manualMode` flips on so
 *      the errors are visible. Files upload immediately via
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Video, Upload, Lock, ArrowRight, ArrowLeft, Loader2, CheckCircle2, RefreshCcw, Receipt, Landmark, Mail, CalendarClock } from 'lucide-react'

/** Trust blue — scoped to the verification step only (identity = trust color);
 *  everything else in the form stays on the forest palette. */
const BLUE = {
  tint: '#E6F1FB',
  border: '#B5D4F4',
  primary: '#185FA5',
  deep: '#0C447C',
}

import { step3Schema, type Step3FormData } from '../../schemas'
import type { KycDocKey, UploadedDocsState, UploadedDoc } from '../../types'
import { startKycSession, checkKycSession } from '../actions'
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
  /** Fired once the Didit decision comes back Approved — the orchestrator
   *  waives the manual ID/selfie requirement and records the session. */
  onKycVerified?: (sessionId: string) => void
  /** An already-approved Didit session (e.g. restored from the saved draft
   *  after a page refresh) — the step mounts straight into "verified". */
  initialVerifiedSessionId?: string | null
}

/** Video-verification affordance state — wired to Didit. */
interface KycVideoState {
  status: 'idle' | 'starting' | 'ready' | 'checking' | 'verified' | 'unavailable'
  /** The hosted verification session URL, once a session exists. */
  kycSessionUrl: string | null
  sessionId: string | null
  message: string | null
}

export default function StepIdentity({
  uploadedDocs,
  onDocChange,
  onContinue,
  onBack,
  sellerType,
  onKycVerified,
  initialVerifiedSessionId,
}: StepIdentityProps) {
  // Step 3 has no free-form inputs — validation runs against the ACTUALLY
  // uploaded documents (each carries a storage path), so a required doc can
  // never pass on a local pick.
  const [errors, setErrors] = useState<Partial<Record<KycDocKey, string>>>({})

  // Didit-first: the manual ID + selfie rows stay hidden until the seller
  // explicitly opts out of the video path (or validation needs to show them).
  const [manualMode, setManualMode] = useState(false)

  const [video, setVideo] = useState<KycVideoState>(() =>
    initialVerifiedSessionId
      ? { status: 'verified', kycSessionUrl: null, sessionId: initialVerifiedSessionId, message: null }
      : { status: 'idle', kycSessionUrl: null, sessionId: null, message: null },
  )
  const kycVerified = video.status === 'verified'

  const handleDocChange = (fileType: string, doc: UploadedDoc | null) => {
    setErrors((prev) => ({ ...prev, [fileType]: undefined }))
    onDocChange(fileType, doc)
  }

  const handleVerifyWithVideo = async () => {
    // ONE session per seller: if a session already exists, reopen the same
    // hosted URL instead of creating a duplicate Didit session.
    if (video.kycSessionUrl) {
      window.open(video.kycSessionUrl, '_blank')
      return
    }
    setVideo((v) => ({ ...v, status: 'starting', message: null }))
    // Claim the popup SYNCHRONOUSLY (inside the click gesture) — calling
    // window.open after the await trips popup blockers, which silently
    // hijacked the flow into the same tab. NOTE: no 'noopener' — the popup
    // must keep window.opener so /kyc/complete can post the result back.
    const popup = window.open('', '_blank')
    try {
      const result = await startKycSession()
      if (result.enabled && result.url) {
        setVideo({
          status: 'ready',
          kycSessionUrl: result.url,
          sessionId: result.sessionId ?? null,
          message: result.message ?? null,
        })
        if (popup) popup.location.href = result.url
        else window.open(result.url, '_blank')
        return
      }
      popup?.close()
      // Unconfigured / errored → graceful fallback to manual uploads below.
      setVideo({
        status: 'unavailable',
        kycSessionUrl: null,
        sessionId: null,
        message:
          result.message ??
          'Video verification is coming soon — please upload your ID and selfie for now.',
      })
    } catch {
      popup?.close()
      setVideo({
        status: 'unavailable',
        kycSessionUrl: null,
        sessionId: null,
        message: 'Could not start video verification. Please upload your ID and selfie for now.',
      })
    }
  }

  /** Verify a session's decision server-side and update the step state. */
  const runDecisionCheck = useCallback(async (sessionId: string) => {
    setVideo((v) => ({ ...v, status: 'checking', message: null }))
    try {
      const result = await checkKycSession(sessionId)
      if (result.status === 'approved') {
        setErrors((prev) => ({ ...prev, idDocument: undefined, selfieWithId: undefined }))
        setVideo((v) => ({ ...v, status: 'verified', sessionId, message: null }))
        onKycVerified?.(sessionId)
        return
      }
      const messages: Record<string, string> = {
        declined:
          'The video verification was declined — please upload your ID and selfie below instead.',
        in_review:
          'Your verification is being reviewed by Didit. You can wait and re-check, or upload your documents below to keep moving.',
        pending:
          'Verification not finished yet — complete it in the other tab, then check again.',
        error: 'Could not check the verification right now — try again in a moment.',
      }
      setVideo((v) => ({
        ...v,
        status: 'ready',
        message: messages[result.status] ?? messages.error,
      }))
    } catch {
      setVideo((v) => ({
        ...v,
        status: 'ready',
        message: 'Could not check the verification right now — try again in a moment.',
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onKycVerified])

  const handleCheckStatus = () => {
    if (video.sessionId) void runDecisionCheck(video.sessionId)
  }

  // The /kyc/complete popup posts { type:'didit:complete', sessionId } back
  // to this tab when Didit finishes — auto-verify so the seller lands on an
  // already-updated step with zero manual clicks.
  const sessionIdRef = useRef<string | null>(null)
  sessionIdRef.current = video.sessionId
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; sessionId?: string }
      if (data?.type !== 'didit:complete') return
      const sessionId = data.sessionId || sessionIdRef.current
      if (sessionId) void runDecisionCheck(sessionId)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [runDecisionCheck])

  // Belt-and-suspenders for the postMessage: when the seller comes BACK to this
  // tab while a session is open, silently re-check the decision — so a finished
  // verification flips to "Identity Verified" without a manual click even if
  // the popup's message was missed (closed tab, blocked opener, etc).
  const videoStatusRef = useRef(video.status)
  videoStatusRef.current = video.status
  const checkInFlightRef = useRef(false)
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return
      if (videoStatusRef.current !== 'ready') return
      const sessionId = sessionIdRef.current
      if (!sessionId || checkInFlightRef.current) return
      checkInFlightRef.current = true
      void Promise.resolve(runDecisionCheck(sessionId)).finally(() => {
        checkInFlightRef.current = false
      })
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [runDecisionCheck])

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (kycVerified) {
      // Didit covered govt ID + liveness/face match; only proof of address
      // still comes from the manual path.
      if (!uploadedDocs.proofOfAddress?.path) {
        setErrors({ proofOfAddress: 'Proof of address upload is required' })
        return
      }
      setErrors({})
      onContinue(uploadedDocs as unknown as Step3FormData)
      return
    }
    const parsed = step3Schema.safeParse(uploadedDocs)
    if (!parsed.success) {
      const errs: Partial<Record<KycDocKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as KycDocKey
        if (key && !errs[key]) errs[key] = issue.message
      }
      setErrors(errs)
      // The failing ID/selfie rows are hidden while the video path is front and
      // center — reveal them so the seller can actually see (and fix) the errors.
      if (!manualMode && !kycVerified && (errs.idDocument || errs.selfieWithId)) {
        setManualMode(true)
      }
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

      {/* ── Section 1 · Identity Check ──────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2.5">
        {kycVerified ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: '#A3E635' }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: '#0F3320' }} strokeWidth={2.5} />
          </span>
        ) : (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ backgroundColor: PALETTE.forest }}
          >
            1
          </span>
        )}
        <h3 className="text-[15px] font-semibold" style={{ color: PALETTE.ink }}>
          Identity Check
        </h3>
      </div>

      {/* ── Verified — quiet completed card replaces the whole CTA section ──── */}
      {kycVerified && (
        <section
          className="flex items-start gap-3.5 rounded-lg border p-5"
          style={{ borderColor: 'rgba(101,163,13,0.35)', backgroundColor: 'rgba(163,230,53,0.14)' }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: PALETTE.forest }}
          >
            <CheckCircle2 className="h-5 w-5" style={{ color: PALETTE.lime }} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold" style={{ color: PALETTE.forest }}>
              Identity Verified
            </h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: PALETTE.ink2 }}>
              Your video check is approved — government ID and selfie are covered.
              Just add your proof of address below and continue.
            </p>
          </div>
        </section>
      )}

      {/* ── Mode switcher — segmented tabs (Design 1, blue trust panel).
            Verification is BLUE on purpose: trust/identity color, scoped to
            this step only; the rest of the form stays forest. ─────────────── */}
      {!kycVerified && (
        <div
          className="inline-flex overflow-hidden rounded-lg border bg-white"
          style={{ borderColor: BLUE.border }}
          role="tablist"
          aria-label="Verification method"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!manualMode}
            onClick={() => setManualMode(false)}
            className="inline-flex min-h-[40px] items-center gap-1.5 px-4 text-[13px] font-semibold transition-colors"
            style={
              !manualMode
                ? { backgroundColor: BLUE.primary, color: '#FFFFFF' }
                : { color: PALETTE.ink2 }
            }
          >
            <Video className="h-4 w-4" />
            Video · 2 Min
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={manualMode}
            onClick={() => setManualMode(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 px-4 text-[13px] font-semibold transition-colors"
            style={
              manualMode
                ? { backgroundColor: BLUE.primary, color: '#FFFFFF' }
                : { color: PALETTE.ink2 }
            }
          >
            <Upload className="h-4 w-4" />
            Upload Documents
          </button>
        </div>
      )}

      {/* ── Video panel — light blue trust card ─────────────────────────────── */}
      {!kycVerified && !manualMode && (
        <section
          className="mt-4 rounded-lg border p-5 sm:p-6"
          style={{ backgroundColor: BLUE.tint, borderColor: BLUE.border }}
        >
          <div className="flex items-start gap-3.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: BLUE.primary }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: '#FFFFFF' }} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold" style={{ color: BLUE.deep }}>
                Verify Your Identity
              </h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: BLUE.primary }}>
                A short guided video check — most sellers finish in under two minutes.
              </p>
            </div>
          </div>

          {/* Start only while NO session exists — once one is open, the status
              row below (Check Status + Reopen) is the whole affordance. */}
          {video.status !== 'ready' && video.status !== 'checking' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleVerifyWithVideo}
                disabled={starting}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: BLUE.primary }}
              >
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Start Verification
                  </>
                )}
              </button>
              <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: BLUE.primary }}>
                <Lock className="h-3.5 w-3.5" />
                Encrypted · Powered By Didit
              </span>
            </div>
          )}

          {/* Unconfigured / graceful state */}
          {video.status === 'unavailable' && video.message && (
            <p
              className="mt-3 rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: 'rgba(255,255,255,0.65)', color: BLUE.deep }}
            >
              {video.message}
            </p>
          )}
          {(video.status === 'ready' || video.status === 'checking') && (
            <div className="mt-3 space-y-2.5">
              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{ backgroundColor: 'rgba(255,255,255,0.65)', color: BLUE.deep }}
              >
                {video.message ??
                  'Verification opened in a new tab. Finish there, then come back and check your status.'}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={video.status === 'checking'}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-70"
                  style={{ backgroundColor: BLUE.primary }}
                >
                  {video.status === 'checking' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-3.5 w-3.5" />
                  )}
                  Check Status
                </button>
                {video.kycSessionUrl && (
                  <button
                    type="button"
                    // window.open WITHOUT noopener — the verification tab needs
                    // window.opener to post the result back and self-close.
                    onClick={() => video.kycSessionUrl && window.open(video.kycSessionUrl, '_blank')}
                    className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium underline underline-offset-2"
                    style={{ color: BLUE.primary }}
                  >
                    Reopen Verification
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Documents panel — the tabs above are the only mode switch. ──────── */}
      {!kycVerified && manualMode && (
        <div className="animate-fade-in mt-4">
          <p className="mb-4 text-[13px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
            Upload your ID and a selfie — our team reviews documents within one
            business day.
          </p>

          <div className="space-y-4">
            <KycUploadRow
              label="Government-Issued ID"
              description="Passport, national ID, or driver's license — the photo page, in full."
              fileType="idDocument"
              doc={uploadedDocs.idDocument}
              onDocChange={handleDocChange}
              required
              error={errors.idDocument}
              sample={{
                title: 'Government-Issued ID',
                tips: [
                  'Passport photo page, national ID, or driver’s license',
                  'All four corners visible — nothing cut off',
                  'Text sharp and readable, no glare or blur',
                  'The original document, not a photocopy or screenshot',
                ],
              }}
            />

            <KycUploadRow
              label="Selfie With ID"
              description="A selfie holding your ID next to your face, with today's date on a note."
              fileType="selfieWithId"
              doc={uploadedDocs.selfieWithId}
              onDocChange={handleDocChange}
              required
              error={errors.selfieWithId}
              sample={{
                title: 'Selfie With ID',
                tips: [
                  'Hold your ID next to your face, both clearly in frame',
                  'Add a note with today’s date, also visible',
                  'Good lighting — your face and the ID text both readable',
                  'No filters, no sunglasses, no hats',
                ],
              }}
            />
          </div>
        </div>
      )}

      {/* ── Section 2 · Proof Of Address (required on BOTH paths) ───────────── */}
      <div className="mb-3 mt-8 flex items-center gap-2.5">
        {uploadedDocs.proofOfAddress?.path ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: '#A3E635' }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: '#0F3320' }} strokeWidth={2.5} />
          </span>
        ) : (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ backgroundColor: PALETTE.forest }}
          >
            2
          </span>
        )}
        <h3 className="text-[15px] font-semibold" style={{ color: PALETTE.ink }}>
          Proof Of Address
        </h3>
      </div>

      {/* Accepted documents as visual chips — reads faster than a sentence. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[
          { icon: Receipt, label: 'Utility Bill' },
          { icon: Landmark, label: 'Bank Statement' },
          { icon: Mail, label: 'Government Letter' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
            style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper, color: PALETTE.ink }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} />
            {label}
          </span>
        ))}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ backgroundColor: '#FBF4E6', color: '#8A6D22' }}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Under 3 Months Old
        </span>
      </div>

      <div className="space-y-4">
        <KycUploadRow
          label="Upload Your Document"
          description=""
          fileType="proofOfAddress"
          doc={uploadedDocs.proofOfAddress}
          onDocChange={handleDocChange}
          required
          error={errors.proofOfAddress}
          sample={{
            title: 'Proof of Address',
            tips: [
              'A utility bill, bank statement, or official government letter',
              'Dated within the last 3 months',
              'Your full name and address clearly visible',
              'All four corners in frame — no crops or glare',
            ],
          }}
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
        className="mt-5 flex items-start gap-2.5 rounded-lg border p-3.5"
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
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-black/[0.03]"
          style={{ borderColor: PALETTE.line, color: PALETTE.forest }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="submit"
          className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors"
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
