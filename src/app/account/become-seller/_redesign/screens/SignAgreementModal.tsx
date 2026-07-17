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
import { X, PenLine, ShieldCheck, ExternalLink, Loader2, Eraser } from 'lucide-react'
import { PALETTE } from '../theme'
import { signSellerAgreement } from '../actions'
import { type SignAgreementResult } from '../integrations'


/**
 * Crop a signature canvas to the bounding box of its non-transparent pixels.
 * Replaces react-signature-canvas's getTrimmedCanvas(), whose trim-canvas
 * dependency fails at runtime under webpack ("trim_canvas__ is not a
 * function"). Falls back to the untrimmed canvas on any error.
 */
function trimSignatureCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const ctx = source.getContext('2d')
    if (!ctx) return source
    const { width, height } = source
    const data = ctx.getImageData(0, 0, width, height).data
    let top = height, left = width, right = 0, bottom = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
    }
    if (right <= left || bottom <= top) return source
    const pad = 6
    left = Math.max(0, left - pad)
    top = Math.max(0, top - pad)
    right = Math.min(width - 1, right + pad)
    bottom = Math.min(height - 1, bottom + pad)
    const out = document.createElement('canvas')
    out.width = right - left + 1
    out.height = bottom - top + 1
    out.getContext('2d')?.drawImage(
      source, left, top, out.width, out.height, 0, 0, out.width, out.height,
    )
    return out
  } catch {
    return source
  }
}

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
  const [padWidth, setPadWidth] = useState(440)
  const [padHeight, setPadHeight] = useState(220)
  const inputRef = useRef<HTMLInputElement>(null)
  const padRef = useRef<SignatureCanvas>(null)
  const padBoxRef = useRef<HTMLDivElement>(null)
  const pendingSignature = useRef<string | null>(null)

  // Size the signature canvas to its container (fixed attrs avoid the
  // classic CSS-scaled-canvas stroke-offset bug). Re-measure on container
  // resize / window resize / orientation change so rotating a phone never
  // leaves a stale-width (clipped or shrunken) canvas.
  useEffect(() => {
    if (!open) return
    const el = padBoxRef.current
    if (!el) return

    const measure = () => {
      setPadWidth(Math.max(260, el.clientWidth - 2))
      // Shorter pad on short viewports so the modal rarely needs scrolling.
      setPadHeight(window.innerHeight < 700 ? 160 : 220)
    }
    // Changing the canvas width/height attributes clears the drawing, so
    // snapshot any strokes first and restore them after React re-renders.
    const snapshotAndMeasure = () => {
      const pad = padRef.current
      // Always overwrite (null when empty) so a stale snapshot can never
      // resurrect a signature the user has since cleared.
      pendingSignature.current = pad && !pad.isEmpty() ? pad.toDataURL() : null
      measure()
    }

    measure()
    const ro = new ResizeObserver(snapshotAndMeasure)
    ro.observe(el)
    window.addEventListener('resize', snapshotAndMeasure)
    window.addEventListener('orientationchange', snapshotAndMeasure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', snapshotAndMeasure)
      window.removeEventListener('orientationchange', snapshotAndMeasure)
    }
  }, [open, loading])

  // Restore the snapshotted signature once the resized canvas has rendered.
  useEffect(() => {
    if (!pendingSignature.current) return
    padRef.current?.fromDataURL(pendingSignature.current)
    pendingSignature.current = null
  }, [padWidth, padHeight])

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
    if (!padRef.current || padRef.current.isEmpty()) {
      setPadError(true)
      return
    }
    onSigned({
      name: typedName.trim(),
      signedAt: new Date().toISOString(),
      signatureImage: trimSignatureCanvas(padRef.current.getCanvas()).toDataURL('image/png'),
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
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
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
                    your behalf. Your typed legal name and drawn signature below, together with the
                    date and time, are recorded as your electronic signature.
                  </p>

                  <a
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-black/[0.03]"
                    style={{ borderColor: PALETTE.line, color: PALETTE.forest2 }}
                  >
                    View The Full Agreement (PDF)
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

                  {/* Drawn signature — signature_pad canvas */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-xs font-medium" style={{ color: PALETTE.ink }}>
                        Draw Your Signature
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          padRef.current?.clear()
                          setPadError(false)
                        }}
                        className="-m-2 inline-flex min-h-[36px] items-center gap-1 rounded-md p-2 text-xs font-semibold"
                        style={{ color: PALETTE.ink2 }}
                      >
                        <Eraser className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                    <div
                      ref={padBoxRef}
                      className="overflow-hidden rounded-lg"
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
                          width: padWidth,
                          height: padHeight,
                          style: { display: 'block', touchAction: 'none' },
                          'aria-label': 'Signature pad',
                        }}
                      />
                    </div>
                    {padError ? (
                      <p className="mt-1.5 text-xs" style={{ color: '#B42318' }}>
                        Draw your signature in the box to sign.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs" style={{ color: PALETTE.ink2 }}>
                        Use your mouse or finger — it&rsquo;s embedded in your signed agreement PDF.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAccept}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-[filter]"
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
