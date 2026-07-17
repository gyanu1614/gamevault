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
import { AnimatePresence, motion } from 'framer-motion'
import { X, PenLine, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react'
import { PALETTE } from '../theme'
import { signSellerAgreement } from '../actions'
import { type SignAgreementResult } from '../integrations'

interface SignAgreementModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fill the typed-name field with the seller's legal name from Step 2. */
  defaultName: string
  /** Called when the agreement is signed: name + ISO timestamp of the signature. */
  onSigned: (signature: { name: string; signedAt: string }) => void
}

export default function SignAgreementModal({
  open,
  onClose,
  defaultName,
  onSigned,
}: SignAgreementModalProps) {
  const [session, setSession] = useState<SignAgreementResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [typedName, setTypedName] = useState(defaultName)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    onSigned({ name: typedName.trim(), signedAt: new Date().toISOString() })
    onClose()
  }

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
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
            style={{ backgroundColor: PALETTE.paper, border: `1px solid ${PALETTE.line}` }}
            role="dialog"
            aria-modal="true"
            aria-label="Sign the Seller Agency Agreement"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ backgroundColor: PALETTE.forest }}
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
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            <div className="px-6 py-5">
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
                    })
                    onClose()
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div
                    className="flex items-start gap-2.5 rounded-xl p-3.5"
                    style={{ backgroundColor: 'rgba(20,67,42,0.05)' }}
                  >
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: PALETTE.forest2 }}
                    />
                    <p className="text-xs leading-relaxed" style={{ color: PALETTE.ink2 }}>
                      {session?.message ??
                        'Sign by typing your full legal name below — this records a legally binding acceptance.'}
                    </p>
                  </div>

                  <p className="text-sm leading-relaxed" style={{ color: PALETTE.ink2 }}>
                    You appoint DropMarket as your disclosed commercial agent to conclude sales on
                    your behalf. Typing your full legal name and clicking{' '}
                    <span style={{ color: PALETTE.ink, fontWeight: 600 }}>Sign &amp; Accept</span>{' '}
                    constitutes your electronic signature, recorded with the date and time.
                  </p>

                  <a
                    href="/seller-agreement"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
                    style={{ color: PALETTE.forest2 }}
                  >
                    Read the full Seller Agency Agreement
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <div>
                    <label
                      className="mb-1.5 block text-xs font-medium"
                      style={{ color: PALETTE.ink }}
                    >
                      Full Legal Name
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={typedName}
                      onChange={(e) => {
                        setTouched(true)
                        setTypedName(e.target.value)
                      }}
                      placeholder="Type your full legal name to sign"
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-shadow"
                      style={{
                        backgroundColor: PALETTE.paper,
                        border: `1px solid ${PALETTE.line}`,
                        color: PALETTE.ink,
                        fontFamily:
                          'ui-serif, Georgia, "Times New Roman", serif',
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

                  <button
                    type="button"
                    onClick={handleAccept}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: PALETTE.forest }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = PALETTE.forest2
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = PALETTE.forest
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
