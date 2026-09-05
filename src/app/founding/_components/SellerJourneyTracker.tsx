'use client'

/**
 * SellerJourneyTracker — "Set Up Your Storefront" (design 2b). The founder's
 * four-step storefront setup, shown on the Founding HQ as one clean card:
 *
 *   [progress header: "N of 4 complete" + lime fill · "Launch: Sep 30"]
 *   ─────────────────────────────────────────────────────────────────
 *   (①) Confirm your email        Verified …                   [ Done ]
 *   (②) Create your account       Pick a store name …   [ Create Account ]
 *   (③) Verify & sign             Confirm your ID …     [ Start Verify ]🔒
 *   (④) List your first item      Post an item …        [ Start Listing ]🔒
 *
 * Each row's action sits on the RIGHT and is styled by state:
 *   done     → a quiet "Done" pill
 *   current  → a solid forest button (the one thing to do next)
 *   upcoming → a locked, disabled button (visible but greyed, with a lock)
 *
 * Step 2 opens a store-name modal that hands off to the real signup flow — the
 * password is set there, never here (the hard rule). Forest Ledger palette.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, ArrowRight, Lock, X, Loader2 } from 'lucide-react'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import SellerFlowLoader from '@/app/account/become-seller/_redesign/components/SellerFlowLoader'
import { createFoundingAccount } from '@/lib/actions/founding-account'
import type { SellerJourney, JourneyStep } from '@/lib/founding/hq-data'

const LIME_INK = '#0F3320'
const LOCK_GREY = '#9AA095'
const LOCK_BORDER = '#E4E5DE'
const LOCK_BG = '#F4F5F0'

// Status-pill palette for the "Get Approved" step once an application exists.
const STATUS_PILL_STYLE: Record<'pending' | 'review' | 'info', React.CSSProperties> = {
  pending: { backgroundColor: '#FBF4E6', color: '#8A6D22' }, // amber-ish "waiting"
  review: { backgroundColor: '#EAF1FB', color: '#2C5AA0' }, // blue "under review"
  info: { backgroundColor: '#FBEDE6', color: '#9A4A22' }, // orange "action needed"
}
const STATUS_PILL_DOT: Record<'pending' | 'review' | 'info', string> = {
  pending: '#D9A72A',
  review: '#3A72C8',
  info: '#C86A2A',
}

export default function SellerJourneyTracker({ journey }: { journey: SellerJourney }) {
  const { steps, doneCount, total } = journey
  const [modalOpen, setModalOpen] = useState(false)
  const [storeName, setStoreName] = useState('')

  const pct = Math.round((doneCount / total) * 100)

  return (
    <div
      className="overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: PALETTE.line, boxShadow: '0 4px 16px -8px rgba(20,67,42,0.10)' }}
    >
      {/* ── Progress header ── */}
      <div className="border-b px-5 py-4" style={{ borderColor: '#EEF0E8' }}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold" style={{ color: PALETTE.ink }}>
            {doneCount} of {total} complete
          </span>
          <span
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: '#F2F4EC', color: PALETTE.forest2 }}
          >
            Beta Launch
          </span>
        </div>
        {/* Progress track. The fill animates to the current %, and a soft lime
            sheen sweeps across it (subtle, infinite) so the bar feels alive. */}
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#EEF0E8' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-full overflow-hidden rounded-full"
            style={{ background: `linear-gradient(90deg, ${PALETTE.forest2}, ${PALETTE.lime})` }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-1/2"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }}
              initial={{ x: '-120%' }}
              animate={{ x: '260%' }}
              transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.1 }}
            />
          </motion.div>
        </div>
      </div>

      {/* ── Steps ── */}
      <ol className="divide-y" style={{ borderColor: '#F1F2EC' }}>
        {steps.map((step, i) => (
          <StepRow
            key={step.key}
            step={step}
            index={i}
            onCreateAccount={() => setModalOpen(true)}
          />
        ))}
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

/** One step row: status circle + title/description (left) · action (right). */
function StepRow({
  step,
  index,
  onCreateAccount,
}: {
  step: JourneyStep
  index: number
  onCreateAccount: () => void
}) {
  const done = step.state === 'done'
  const current = step.state === 'current'
  const upcoming = step.state === 'upcoming'
  // The "create account" path (a logged-OUT founder) opens the store-name modal;
  // everything else — including step 2's "Set Up Store" for a logged-IN founder,
  // which links straight to the seller wizard — is a plain link.
  const isCreateAccount = step.key === 'application' && step.action?.href?.startsWith('/signup-become-seller')

  return (
    <li
      className="flex items-center gap-3.5 px-5 py-4"
      style={{ backgroundColor: current ? '#FBFCF8' : 'transparent' }}
    >
      {/* status circle */}
      <span className="relative shrink-0">
        {done ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: PALETTE.lime }}>
            <Check className="h-4 w-4" style={{ color: LIME_INK }} strokeWidth={3} />
          </span>
        ) : current ? (
          <motion.span
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: PALETTE.forest, color: '#fff' }}
          >
            <span className="text-[13px] font-bold">{index + 1}</span>
          </motion.span>
        ) : (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px]"
            style={{ borderColor: LOCK_BORDER, color: LOCK_GREY }}
          >
            <span className="text-[13px] font-bold">{index + 1}</span>
          </span>
        )}
      </span>

      {/* title + description */}
      <div className="min-w-0 flex-1">
        <div
          className="text-[14.5px] font-semibold leading-tight"
          style={{ color: done ? PALETTE.ink : current ? PALETTE.forest : '#8C9187' }}
        >
          {step.label}
        </div>
        <p
          className="mt-0.5 text-[12.5px] leading-snug"
          style={{ color: upcoming ? '#A7AC9F' : PALETTE.ink2 }}
        >
          {step.hint}
        </p>
      </div>

      {/* right-aligned action */}
      <div className="shrink-0">
        {step.statusPill ? (
          // Application submitted → show its status (Pending / Under Review /
          // Info Requested) instead of an action button.
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold"
            style={STATUS_PILL_STYLE[step.statusPill.tone]}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: STATUS_PILL_DOT[step.statusPill.tone] }}
            />
            {step.statusPill.label}
          </span>
        ) : done ? (
          <span
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold"
            style={{ backgroundColor: '#EFF6EA', color: PALETTE.forest2 }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Done
          </span>
        ) : !step.action ? null : current ? (
          isCreateAccount ? (
            <button
              type="button"
              onClick={onCreateAccount}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
              style={{ backgroundColor: PALETTE.forest }}
            >
              {step.action.label}
              <ArrowRight className="h-3.5 w-3.5" style={{ color: PALETTE.lime }} strokeWidth={2.5} />
            </button>
          ) : (
            <Link
              href={step.action.href}
              className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
              style={{ backgroundColor: PALETTE.forest }}
            >
              {step.action.label}
              <ArrowRight className="h-3.5 w-3.5" style={{ color: PALETTE.lime }} strokeWidth={2.5} />
            </Link>
          )
        ) : (
          // upcoming — locked, disabled, but visible
          <span
            aria-disabled
            title="Unlocks after the previous step"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: LOCK_BORDER, backgroundColor: LOCK_BG, color: LOCK_GREY }}
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
            {step.action.label}
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * One-step account modal. The founder reached the HQ via their magic link, so
 * the email is already proven — this collects store name + password and creates
 * the account directly (pre-confirmed, no confirmation email), then drops them
 * into the seller application. Falls back to the secure signup page when the
 * invite token isn't in the URL.
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
  const params = useSearchParams()
  const inviteId = params.get('id') || ''
  const inviteToken = params.get('token') || ''
  const hasInvite = Boolean(inviteId && inviteToken)

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [navigating, setNavigating] = useState(false)

  const fallbackHref = `/signup-become-seller?src=founding-hq${storeName.trim() ? `&store=${encodeURIComponent(storeName.trim())}` : ''}`

  const submit = async () => {
    setError(null)
    if (storeName.trim().length < 3) return setError('Store name must be at least 3 characters.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setCreating(true)
    try {
      const res = await createFoundingAccount({
        id: inviteId,
        token: inviteToken,
        storeName: storeName.trim(),
        password,
      })
      if (res.success) {
        // Account live + signed in → stay on the HQ: a FULL reload (not client
        // nav) makes the whole app pick up the fresh session cookies, and the
        // server re-resolves the journey — step 2 shows Done ✓ and step 3
        // ("Get Approved") becomes the next action.
        setNavigating(true)
        window.location.reload()
        return
      }
      setError(
        res.error === 'account_exists'
          ? 'You already have an account with this email — use Check Status (top right) to log in.'
          : res.error || 'Something went wrong. Please try again.',
      )
      setCreating(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setCreating(false)
    }
  }

  if (navigating) return <SellerFlowLoader label="Setting up your store…" />

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,51,32,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-lg bg-white p-8"
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
          className="w-full rounded-md border px-3.5 outline-none placeholder:text-[#9AA095]"
          style={{ height: 46, borderColor: PALETTE.line, fontSize: 15, color: PALETTE.ink, backgroundColor: '#FFFFFF' }}
          onFocus={(e) => (e.target.style.borderColor = PALETTE.forest)}
          onBlur={(e) => (e.target.style.borderColor = PALETTE.line)}
        />
        <p className="mt-1.5 text-[12px]" style={{ color: PALETTE.ink2 }}>
          Buyers see this. You can change it once before launch.
        </p>

        {hasInvite ? (
          <>
            <label className="mb-2 mt-4 block text-[13px] font-semibold" style={{ color: PALETTE.ink }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full rounded-md border px-3.5 outline-none placeholder:text-[#9AA095]"
              style={{ height: 46, borderColor: PALETTE.line, fontSize: 15, color: PALETTE.ink, backgroundColor: '#FFFFFF' }}
              onFocus={(e) => (e.target.style.borderColor = PALETTE.forest)}
              onBlur={(e) => (e.target.style.borderColor = PALETTE.line)}
            />

            {error && (
              <p className="mt-3 text-[13px] font-medium" style={{ color: '#B42318' }}>{error}</p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={creating}
              className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold text-white transition-colors disabled:opacity-70"
              style={{ backgroundColor: PALETTE.forest }}
            >
              {creating ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  Creating Your Account…
                </>
              ) : (
                <>
                  Create Account &amp; Continue
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: PALETTE.lime }} strokeWidth={2.5} />
                </>
              )}
            </button>
          </>
        ) : (
          // No invite token in the URL (e.g. opened /founding directly) — hand
          // off to the secure signup flow that confirms the email itself.
          <Link
            href={fallbackHref}
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold text-white transition-colors"
            style={{ backgroundColor: PALETTE.forest }}
          >
            Continue To Secure Signup
            <ArrowRight className="h-[18px] w-[18px]" style={{ color: PALETTE.lime }} strokeWidth={2.5} />
          </Link>
        )}
        <button type="button" onClick={onClose} className="mt-2.5 w-full text-center text-[13px] font-medium" style={{ color: PALETTE.ink2 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
