'use client'

/**
 * SellerJourneyTracker — the founder's 4-step gated setup (Screen 2b), shown on
 * the Founding HQ. Steps: Confirm Email (auto-done) → Create Account → Verify &
 * Sign → First Listing. Each step is done / current / locked. The current step
 * surfaces its action button (from step.action). Step 2 opens a store-name modal
 * that hands off to the real signup flow (password is set there — never here).
 *
 * Forest Ledger palette; matches design-refs/founding-seller (Screen 2b).
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, ArrowRight, X } from 'lucide-react'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import type { SellerJourney } from '@/lib/founding/hq-data'

const LIME_INK = '#0F3320'

export default function SellerJourneyTracker({ journey }: { journey: SellerJourney }) {
  const { steps } = journey
  const [modalOpen, setModalOpen] = useState(false)
  const [storeName, setStoreName] = useState('')

  return (
    <div
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: PALETTE.line, boxShadow: '0 2px 8px rgba(20,67,42,0.04)' }}
    >
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const done = step.state === 'done'
          const current = step.state === 'current'
          // Step 2 ("create your account") opens the modal; others are links.
          const isCreateAccount = step.key === 'application'

          return (
            <li key={step.key} className="relative flex gap-3">
              {/* connector */}
              {!isLast && (
                <span aria-hidden className="absolute left-[11px] top-6 w-[2px]" style={{ bottom: 0, backgroundColor: done ? PALETTE.forest2 : '#EAEBE3' }} />
              )}

              {/* node */}
              <span className="relative z-10 shrink-0">
                {done ? (
                  <span className="flex h-[23px] w-[23px] items-center justify-center rounded-full" style={{ backgroundColor: PALETTE.lime }}>
                    <Check className="h-3.5 w-3.5" style={{ color: LIME_INK }} strokeWidth={3} />
                  </span>
                ) : current ? (
                  <motion.span
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="flex h-[23px] w-[23px] items-center justify-center rounded-full border-[1.5px]"
                    style={{ borderColor: PALETTE.forest, color: PALETTE.forest }}
                  >
                    <span className="text-[12px] font-bold">{i + 1}</span>
                  </motion.span>
                ) : (
                  <span className="flex h-[23px] w-[23px] items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: '#DDE0D3', color: '#9AA095' }}>
                    <span className="text-[12px] font-bold">{i + 1}</span>
                  </span>
                )}
              </span>

              {/* label + hint + action */}
              <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="text-[14px] font-semibold leading-[23px]"
                    style={{ color: current ? PALETTE.forest : done ? PALETTE.ink : '#9AA095' }}
                  >
                    {step.label}
                  </div>
                  {done && <span className="text-[13px] font-semibold" style={{ color: PALETTE.forest2 }}>Done</span>}
                </div>

                {current && (
                  <>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: PALETTE.ink2 }}>{step.hint}</p>
                    {step.action &&
                      (isCreateAccount ? (
                        <button
                          type="button"
                          onClick={() => setModalOpen(true)}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                          style={{ backgroundColor: PALETTE.forest }}
                        >
                          {step.action.label}
                        </button>
                      ) : (
                        <Link
                          href={step.action.href}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                          style={{ backgroundColor: PALETTE.forest }}
                        >
                          {step.action.label}
                          <ArrowRight className="h-3.5 w-3.5" style={{ color: PALETTE.lime }} strokeWidth={2.5} />
                        </Link>
                      ))}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {modalOpen && (
        <CreateAccountModal
          storeName={storeName}
          setStoreName={setStoreName}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Store-name modal. Collects the store name only, then hands off to the real
 * signup flow (which securely sets the password + confirms the email). We do
 * NOT collect a password here.
 */
function CreateAccountModal({
  storeName,
  setStoreName,
  onClose,
}: {
  storeName: string
  setStoreName: (v: string) => void
  onClose: () => void
}) {
  const href = `/signup-become-seller?src=founding-hq${storeName.trim() ? `&store=${encodeURIComponent(storeName.trim())}` : ''}`
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,51,32,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-xl bg-white p-9"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-[21px] font-extrabold" style={{ color: PALETTE.ink, letterSpacing: '-0.3px' }}>
              Create Your Seller Account
            </h3>
            <p className="mt-1 text-[13.5px]" style={{ color: PALETTE.ink2 }}>
              Your email is already verified <span style={{ color: PALETTE.forest2 }}>✓</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1" style={{ color: PALETTE.ink2 }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-2 block text-[13px] font-semibold" style={{ color: PALETTE.ink }}>Store Name</label>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="e.g. ForestPets"
          className="w-full rounded-[10px] border px-3.5 outline-none"
          style={{ height: 46, borderColor: PALETTE.line, fontSize: 15, color: PALETTE.ink }}
          onFocus={(e) => (e.target.style.borderColor = PALETTE.forest)}
          onBlur={(e) => (e.target.style.borderColor = PALETTE.line)}
        />
        <p className="mt-1.5 text-[12px]" style={{ color: PALETTE.ink2 }}>
          Buyers see this. You can change it once before launch.
        </p>

        <p className="mt-4 rounded-lg p-3 text-[12.5px] leading-relaxed" style={{ backgroundColor: '#F7F8F3', color: PALETTE.ink2 }}>
          Next you’ll set a password on the secure signup screen — that finishes creating your account.
        </p>

        <Link
          href={href}
          className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] text-[15px] font-bold text-white transition-colors"
          style={{ backgroundColor: PALETTE.forest }}
        >
          Continue To Secure Signup
          <ArrowRight className="h-[18px] w-[18px]" style={{ color: PALETTE.lime }} strokeWidth={2.5} />
        </Link>
        <button type="button" onClick={onClose} className="mt-2.5 w-full text-center text-[13px] font-medium" style={{ color: PALETTE.ink2 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
