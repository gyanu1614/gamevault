/**
 * SignAgreementModal — the "Sign the Seller Agency Agreement" dialog for the
 * redesigned Review & Sign step.
 *
 * Behaviour is env-gated by the `signSellerAgreement()` server stub:
 *   • When DocuSeal is configured it returns { enabled:true, embedSrc } and this
 *     modal renders the @docuseal/react <DocusealForm> (loaded lazily so the app
 *     never statically imports a package that isn't installed yet).
 *   • When unconfigured (the current state) it returns { enabled:false } and the
 *     modal falls back to a typed-name click-accept: the seller types their full
 *     legal name and clicks "Sign & Accept", which records the name + an ISO
 *     timestamp back to the parent (→ seller_signature / seller_signed_at +
 *     accepted_seller_agreement via the adapter).
 *
 * Light "Forest Ledger" world — the whole application deliberately stays light
 * even under a dark OS theme. All colours come from PALETTE, no Tailwind tokens.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { AnimatePresence, motion } from 'framer-motion'
import { X, PenLine, ExternalLink, Loader2, Eraser } from 'lucide-react'
import { PALETTE } from '../theme'
import { signSellerAgreement } from '../actions'
import { type SignAgreementResult } from '../integrations'


interface SignAgreementModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fill the typed-name field with the seller's legal name from Step 2. */
  defaultName: string
  /** Shop name + country from Step 2 — used for the personalized PDF preview. */
  shopName?: string
  country?: string
  /** Called when signed: name + ISO timestamp + drawn signature (PNG data URL). */
  onSigned: (signature: { name: string; signedAt: string; signatureImage: string | null }) => void
}

export default function SignAgreementModal({
  open,
  onClose,
  defaultName,
  shopName,
  country,
  onSigned,
}: SignAgreementModalProps) {
  const [session, setSession] = useState<SignAgreementResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [typedName, setTypedName] = useState(defaultName)
  const [touched, setTouched] = useState(false)
  const [padError, setPadError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const padRef = useRef<SignatureCanvas>(null)

  // Fetch the (stubbed) e-sign session each time the modal opens so the env flag
  // is always respected — DocuSeal drops in later without touching this UI.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    signSellerAgreement()
      .then((res) => {
        if (!cancelled) setSession(res)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Keep the typed name synced with the legal name until the seller edits it.
  useEffect(() => {
    if (!touched) setTypedName(defaultName)
  }, [defaultName, touched])

  const nameValid = typedName.trim().length >= 2

  const handleAccept = () => {
    if (!nameValid) {
      setTouched(true)
      inputRef.current?.focus()
      return
    }
    // A drawn signature is required too — the typed name + the drawn mark +
    // timestamp together are the binding e-signature (embedded in the PDF).
    if (!padRef.current || padRef.current.isEmpty()) {
      setPadError(true)
      return
    }
    onSigned({
      name: typedName.trim(),
      signedAt: new Date().toISOString(),
      signatureImage: padRef.current.getCanvas().toDataURL('image/png'),
    })
    onClose()
  }

  const previewHref = `/api/seller-agreement/preview?name=${encodeURIComponent(
    typedName.trim() || defaultName,
  )}&shop=${encodeURIComponent(shopName ?? '')}&country=${encodeURIComponent(country ?? '')}`

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(15,51,32,0.55)' }}
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-lg"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 55%, #FCFCFA 100%)',
              border: `1px solid ${PALETTE.line}`,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.04), 0 10px 24px -12px rgba(0,0,0,0.5)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Sign the Seller Agency Agreement"
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-6 py-4"
              style={{
                background: 'linear-gradient(180deg, #1B5E3A 0%, #14432A 55%, #103A22 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.28)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <PenLine className="h-5 w-5" style={{ color: PALETTE.lime }} />
                <h3 className="text-base font-semibold text-white">
                  Sign the Seller Agency Agreement
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-my-1.5 -mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {loading ? (
                <div
                  className="flex items-center justify-center gap-2 py-10 text-sm"
                  style={{ color: PALETTE.ink2 }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing your agreement…
                </div>
              ) : session?.enabled && session.embedSrc ? (
                <DocuSealEmbed
                  src={session.embedSrc}
                  onComplete={() => {
                    onSigned({
                      name: (defaultName || 'Seller').trim(),
                      signedAt: new Date().toISOString(),
                      signatureImage: null,
                    })
                    onClose()
                  }}
                />
              ) : (
                <div className="space-y-3.5">
                  {/* One tight line on what signing means. */}
                  <p className="text-[13px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                    You appoint DropMarket as your disclosed commercial agent to conclude sales on
                    your behalf. Typing your full legal name below, with the date and time, is your
                    binding electronic signature.
                  </p>

                  {/* Small, tasteful "read the full agreement" link. */}
                  <a
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold underline underline-offset-2 transition-colors hover:opacity-80"
                    style={{ color: PALETTE.forest2 }}
                  >
                    Read the full agreement (PDF)
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-medium" style={{ color: PALETTE.ink }}>
                      Sign — type your full legal name
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={typedName}
                      onChange={(e) => {
                        setTouched(true)
                        setTypedName(e.target.value)
                      }}
                      placeholder="Your full legal name"
                      className="w-full rounded-md px-3.5 py-2.5 text-sm outline-none transition-shadow"
                      style={{
                        backgroundColor: PALETTE.paper,
                        border: `1px solid ${PALETTE.line}`,
                        color: PALETTE.ink,
                        fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                        fontStyle: 'italic',
                        fontSize: '1.05rem',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(27,94,58,0.18)`
                        e.currentTarget.style.borderColor = PALETTE.forest2
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = PALETTE.line
                      }}
                    />
                    {touched && !nameValid && (
                      <p className="mt-1.5 text-xs" style={{ color: '#B42318' }}>
                        Type your full legal name to sign.
                      </p>
                    )}
                  </div>

                  {/* Compact drawn signature — fixed size, no resize gymnastics. */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-[12.5px] font-medium" style={{ color: PALETTE.ink }}>
                        Draw your signature
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          padRef.current?.clear()
                          setPadError(false)
                        }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium"
                        style={{ color: PALETTE.ink2 }}
                      >
                        <Eraser className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                    <div
                      className="overflow-hidden rounded-md"
                      style={{
                        border: `1.5px dashed ${padError ? '#B42318' : PALETTE.line}`,
                        backgroundColor: PALETTE.ivory,
                      }}
                    >
                      <SignatureCanvas
                        ref={padRef}
                        penColor={PALETTE.forest3}
                        onBegin={() => setPadError(false)}
                        canvasProps={{
                          width: 420,
                          height: 130,
                          className: 'w-full',
                          style: { display: 'block', touchAction: 'none' },
                          'aria-label': 'Signature pad',
                        }}
                      />
                    </div>
                    {padError && (
                      <p className="mt-1.5 text-xs" style={{ color: '#B42318' }}>
                        Draw your signature in the box to sign.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAccept}
                    className="group flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white transition-[filter]"
                    style={{
                      background:
                        'linear-gradient(180deg, #1B5E3A 0%, #14432A 55%, #103A22 100%)',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.25), 0 6px 14px -6px rgba(20,67,42,0.5)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.12)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = 'none'
                    }}
                  >
                    <PenLine className="h-4 w-4" style={{ color: PALETTE.lime }} />
                    Sign &amp; Accept
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/**
 * DocuSealEmbed — lazily loads @docuseal/react ONLY when a live embed source
 * exists (i.e. DocuSeal is configured). The dynamic import is wrapped so that,
 * until the package is installed, this code path is simply never taken and the
 * static bundle never references it.
 */
function DocuSealEmbed({
  src,
  onComplete,
}: {
  src: string
  onComplete: () => void
}) {
  const [Form, setForm] = useState<React.ComponentType<
    Record<string, unknown>
  > | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // @docuseal/react is an OPTIONAL dependency — only installed once DocuSeal
    // is wired. Build the specifier at runtime + webpackIgnore so the bundler
    // never tries to resolve it at build time (it isn't in package.json yet).
    // Until then this catch() path shows the typed-name fallback.
    const pkg = ['@docuseal', 'react'].join('/')
    ;(new Function('p', 'return import(/* webpackIgnore: true */ p)') as (p: string) => Promise<{ DocusealForm?: React.ComponentType<Record<string, unknown>> }>)(pkg)
      .then((mod) => {
        if (!cancelled) {
          if (mod.DocusealForm) setForm(() => mod.DocusealForm!)
          else setFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: PALETTE.ink2 }}>
        The e-signature form could not be loaded. Please try again later.
      </p>
    )
  }

  if (!Form) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-10 text-sm"
        style={{ color: PALETTE.ink2 }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading the signing form…
      </div>
    )
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <Form src={src} onComplete={onComplete} />
    </div>
  )
}
