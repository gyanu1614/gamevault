'use client'

/**
 * SignupToSellFlow — the "sign up to sell" experience, rendered in the SAME
 * shell as the seller application (SellerAppLayout: forest photographic left
 * rail with the circular numbered stepper, ivory right pane, no site chrome).
 * It reuses that shell verbatim via a `rail` override (3 steps + its own
 * heading/trust copy), so this funnel and /account/become-seller are visually
 * one continuous flow. On email confirmation the magic link lands the user
 * straight in /account/become-seller.
 *
 * Three-phase client state machine (signup → confirm email → handoff):
 *   entry resolver (from useAuth):
 *     loading            → shell with a spinner
 *     authed             → 'handoff' (a logged-in user NEVER resolves to signup,
 *                          so browser-back can't re-fire signup)
 *     logged out         → 'signup'
 *   'signup'  --submit ok, confirm ON--> 'confirm' (+ 30s resend cooldown)
 *             --submit ok, confirm OFF--> push /account/become-seller
 *             --login submit ok-------> push /account/become-seller
 *   'confirm' --BACK--> 'signup' (fields kept, NEVER re-signs-up)
 *             --resend--> resendConfirmationEmail (30s cooldown)
 *             (the magic link leaves the tab → /auth/callback → become-seller)
 *   'handoff' --Start Seller Application--> push /account/become-seller
 *
 * Reuses: SellerAppLayout + its rail (parameterized), the light-world field
 * tokens (inputBaseClass/Style), the PALETTE, and signup/login/
 * resendConfirmationEmail/generateUniqueGamerTag from @/lib/actions/auth.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Mail,
  Lock,
  UserPlus,
  MailCheck,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import SellerAppLayout from '@/app/account/become-seller/_redesign/components/SellerAppLayout'
import StepHeader from '@/app/account/become-seller/_redesign/components/StepHeader'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import {
  inputBaseClass,
  inputBaseStyle,
} from '@/app/account/become-seller/_redesign/components/fields/styles'
import {
  signup,
  login,
  resendConfirmationEmail,
  generateUniqueGamerTag,
  checkEmailAvailability,
} from '@/lib/actions/auth'
import { useAuth } from '@/hooks/use-auth'

const APP_HREF = '/account/become-seller'
/** Founding sellers arrive with ?src=founding-hq and must return to their HQ
 *  after signup/confirm (not the generic become-seller page) — the HQ is their
 *  hub, and it advances to the next step (Get Approved) once the account exists. */
const FOUNDING_HREF = '/founding'

/** The 3 steps for this funnel — fed to the shared rail via SellerAppLayout. */
const STEPS = [
  { id: 1, label: 'Create account' },
  { id: 2, label: 'Confirm email' },
  { id: 3, label: 'Start application' },
] as const

/** "Why we ask" trust copy per step (mirrors the seller app's rail block). */
const TRUST_BY_STEP: Record<number, { title: string; body: string }> = {
  1: {
    title: 'Why sign up',
    body: 'Your account is what lets you list, get paid, and track every sale in one place.',
  },
  2: {
    title: 'Why confirm',
    body: 'A verified email keeps your account and your payouts secure — and it’s quick.',
  },
  3: {
    title: 'Almost there',
    body: 'A short one-time application, then you’re cleared to list and start selling.',
  },
}

type Phase = 'loading' | 'signup' | 'confirm' | 'handoff'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Persist the confirm step across a refresh. This is an important, multi-step
 * process — a reload while waiting on the confirmation email must NOT drop the
 * user back to step 1. We keep it in sessionStorage (survives refresh, dies
 * with the tab, never leaves the device — email is personal data and must not
 * go in the URL). Only 'confirm' is persisted: 'signup' is the default and
 * 'handoff' is derived from auth, so neither needs restoring.
 */
const PERSIST_KEY = 'dm.signup-to-sell'

type Persisted = { phase: 'confirm'; email: string }

function readPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Persisted
    return p?.phase === 'confirm' && typeof p.email === 'string' ? p : null
  } catch {
    return null
  }
}

function writePersisted(p: Persisted | null) {
  if (typeof window === 'undefined') return
  try {
    if (p) window.sessionStorage.setItem(PERSIST_KEY, JSON.stringify(p))
    else window.sessionStorage.removeItem(PERSIST_KEY)
  } catch {
    /* storage unavailable (private mode / quota) — degrade to in-memory only */
  }
}

export function SignupToSellFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()

  // Where this funnel returns to after account/confirm. Founding-flow entrants
  // (?src=founding-hq, sent by the /founding store-name modal) go back to their
  // Founding HQ, which then shows step 2 done + step 3 (Get Approved) current.
  // Everyone else goes to the generic seller application.
  const appHref = searchParams.get('src') === 'founding-hq' ? FOUNDING_HREF : APP_HREF

  const [phase, setPhase] = useState<Phase>('loading')
  const [direction, setDirection] = useState<1 | -1>(1)

  // Signup fields — kept in state so BACK from 'confirm' never re-fires signup.
  // Email seeds from any persisted confirm step so a refresh keeps it filled in.
  const [email, setEmail] = useState(() => readPersisted()?.email ?? '')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signup' | 'login'>('signup')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when signup is blocked because the email already exists — drives the
  // one-tap "Log in instead" affordance under the error.
  const [emailTaken, setEmailTaken] = useState(false)

  const [resendCooldown, setResendCooldown] = useState(0)
  const resolvedRef = useRef(false)

  // ── Entry resolver — derive the phase once auth settles. Precedence:
  //    1) authed  → 'handoff' (they're verified; e.g. confirmed in another tab)
  //    2) a persisted 'confirm' → restore it, so a refresh while waiting on the
  //       confirmation email keeps the user on step 2 (state-preserving).
  //    3) otherwise → 'signup'.
  //    A logged-in user NEVER resolves to signup/confirm, so back-nav from the
  //    application can't re-trigger signup.
  useEffect(() => {
    if (loading) return
    if (resolvedRef.current && phase !== 'loading') return
    resolvedRef.current = true
    if (user) {
      writePersisted(null)
      setPhase('handoff')
      return
    }
    const saved = readPersisted()
    setPhase(saved ? 'confirm' : 'signup')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user])

  // Persist / clear the confirm step whenever the phase (or email) changes, so a
  // refresh restores it. Only 'confirm' is stored; leaving it clears storage.
  useEffect(() => {
    if (phase === 'confirm') writePersisted({ phase: 'confirm', email })
    else if (phase === 'signup' || phase === 'handoff') writePersisted(null)
  }, [phase, email])

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const currentStep = phase === 'confirm' ? 2 : phase === 'handoff' ? 3 : 1

  function goTo(next: Phase, dir: 1 | -1) {
    setError(null)
    setDirection(dir)
    setPhase(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setSubmitting(true)
    try {
      if (mode === 'login') {
        const res = await login({ email, password })
        if (res?.error) return setError(res.error)
        router.push(appHref)
        return
      }

      // Honest duplicate check — Supabase's signUp FAKES success for an email
      // that already exists (anti-enumeration): it returns no session and no
      // error, so without this we'd show "Check your inbox" while no email is
      // ever sent. Surface it as a real error with a log-in path instead.
      const emailCheck = await checkEmailAvailability(email)
      if (!emailCheck.available) {
        setEmailTaken(true)
        return setError(
          emailCheck.error ?? 'That email is already registered. Log in instead.',
        )
      }

      // The visible form is email+password only; generate a unique gamertag
      // behind the scenes (same as the auth dialog does). redirectTo makes the
      // confirmation-email link land the user straight in the seller wizard.
      const { username } = await generateUniqueGamerTag()
      const res = await signup({ email, password, username, redirectTo: appHref })
      if (res?.error) return setError(res.error)

      if (res?.requiresEmailConfirmation) {
        goTo('confirm', 1)
        setResendCooldown(30)
      } else {
        // Confirmation OFF → session already live → into the application.
        router.push(appHref)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !email) return
    setResendCooldown(30)
    try {
      await resendConfirmationEmail(email)
    } catch {
      /* non-fatal — the cooldown still runs so we don't hammer it */
    }
  }

  return (
    <SellerAppLayout
      currentStep={currentStep}
      rail={{
        steps: STEPS,
        heading: 'Become a Seller',
        subheading:
          'Create your account, confirm your email, then complete a short seller application.',
        trustByStep: TRUST_BY_STEP,
      }}
    >
      {/* Vertically centre this flow's content in the right pane (it's short —
          a couple of fields — so top-alignment left a big empty gap below).
          min-h-full centres against the pane's height on desktop; on mobile the
          pane just grows and it reads as normal top-flow. */}
      <div className="flex min-h-full flex-col justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={phase}
            custom={direction}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -20 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
          {phase === 'loading' && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: PALETTE.ink2 }} />
            </div>
          )}

          {phase === 'signup' && (
            <SignupPane
              mode={mode}
              email={email}
              password={password}
              submitting={submitting}
              error={error}
              emailTaken={emailTaken}
              onEmail={(v) => {
                setEmail(v)
                // Editing the email clears a stale "already registered" error.
                if (emailTaken) {
                  setEmailTaken(false)
                  setError(null)
                }
              }}
              onPassword={setPassword}
              onSubmit={handleSubmit}
              onSwitchToLogin={() => {
                setMode('login')
                setEmailTaken(false)
                setError(null)
              }}
              onToggleMode={() => {
                setMode((m) => (m === 'signup' ? 'login' : 'signup'))
                setEmailTaken(false)
                setError(null)
              }}
            />
          )}

          {phase === 'confirm' && (
            <ConfirmPane
              email={email}
              resendCooldown={resendCooldown}
              onResend={handleResend}
              onBack={() => goTo('signup', -1)}
            />
          )}

          {phase === 'handoff' && <HandoffPane onStart={() => router.push(appHref)} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </SellerAppLayout>
  )
}

/* ─────────────────────────────  Panes  ───────────────────────────── */

function FieldLabel({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <span
      className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium"
      style={{ color: PALETTE.ink }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: PALETTE.ink2 }} />
      {children}
    </span>
  )
}

function PrimaryButton({
  children,
  submitting,
  type = 'submit',
  onClick,
}: {
  children: React.ReactNode
  submitting?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={submitting}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
      style={{
        backgroundColor: PALETTE.forest,
        boxShadow: hover && !submitting ? `0 0 0 2px ${PALETTE.lime}` : 'none',
      }}
    >
      {children}
    </button>
  )
}

function SignupPane({
  mode,
  email,
  password,
  submitting,
  error,
  emailTaken,
  onEmail,
  onPassword,
  onSubmit,
  onSwitchToLogin,
  onToggleMode,
}: {
  mode: 'signup' | 'login'
  email: string
  password: string
  submitting: boolean
  error: string | null
  emailTaken: boolean
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onSwitchToLogin: () => void
  onToggleMode: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <StepHeader
        heading={mode === 'signup' ? 'Create your account' : 'Log in to continue'}
        explainer={
          mode === 'signup'
            ? 'Takes a minute. You’ll confirm your email, then complete a quick seller application.'
            : 'Log in and we’ll take you straight to the seller application.'
        }
        icon={UserPlus}
      />

      <div className="space-y-4">
        <label className="block">
          <FieldLabel icon={Mail}>Email</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
            className={inputBaseClass}
            style={inputBaseStyle}
          />
        </label>
        <label className="block">
          <FieldLabel icon={Lock}>Password</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            className={inputBaseClass}
            style={inputBaseStyle}
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-[13px] font-medium text-red-600">
          {error}
          {emailTaken && (
            <>
              {' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-semibold underline underline-offset-2 hover:opacity-80"
              >
                Log in instead
              </button>
            </>
          )}
        </p>
      )}

      <div className="mt-6">
        <PrimaryButton submitting={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {mode === 'signup' ? 'Create account & continue' : 'Log in & continue'}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </PrimaryButton>
      </div>

      <button
        type="button"
        onClick={onToggleMode}
        className="mt-4 w-full text-center text-[13px] transition-opacity hover:opacity-80"
        style={{ color: PALETTE.ink2 }}
      >
        {mode === 'signup'
          ? 'Already have an account? Log in'
          : 'Need an account? Sign up'}
      </button>
    </form>
  )
}

function ConfirmPane({
  email,
  resendCooldown,
  onResend,
  onBack,
}: {
  email: string
  resendCooldown: number
  onResend: () => void
  onBack: () => void
}) {
  return (
    // A self-contained confirmation card — this step has no form fields, so
    // without a panel it read as loose floating text. Centred content inside a
    // paper card in the light Forest Ledger world.
    <div
      className="rounded-2xl border p-8 text-center shadow-sm sm:p-10"
      style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper }}
    >
      <span
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(20,67,42,0.08)', color: PALETTE.forest2 }}
      >
        <MailCheck className="h-7 w-7" />
      </span>

      <h2
        className="text-2xl font-semibold tracking-tight"
        style={{ color: PALETTE.forest }}
      >
        Check your inbox
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: PALETTE.ink2 }}>
        We sent a confirmation link to verify your email. Click it and you’ll land straight in
        the seller application, already logged in.
      </p>

      {/* The email, called out in its own pill so it reads as the key detail. */}
      <div
        className="mx-auto mt-5 inline-flex max-w-full items-center gap-2 rounded-lg border px-3.5 py-2.5"
        style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.ivory }}
      >
        <Mail className="h-4 w-4 shrink-0" style={{ color: PALETTE.ink2 }} />
        <span className="truncate text-sm font-semibold" style={{ color: PALETTE.ink }}>
          {email}
        </span>
      </div>

      {/* Primary action — resend, full width like the signup CTA. */}
      <button
        type="button"
        onClick={onResend}
        disabled={resendCooldown > 0}
        className="mt-6 inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-60"
        style={{ borderColor: PALETTE.line, color: PALETTE.forest, backgroundColor: PALETTE.paper }}
      >
        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
      </button>

      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
        Didn’t get it? Check your spam folder, or resend above.
      </p>

      {/* Back to the sign-up form (also lets them use a different email),
          separated by a hairline. Fields are preserved — going back never
          re-fires signup. */}
      <div className="mt-6 border-t pt-5" style={{ borderColor: PALETTE.line }}>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: PALETTE.ink2 }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign up
        </button>
      </div>
    </div>
  )
}

function HandoffPane({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <StepHeader
        heading="You’re in — start your application"
        explainer="A short one-time application, then you’re cleared to list and start selling."
        icon={Rocket}
      />

      <div className="mt-1">
        <PrimaryButton type="button" onClick={onStart}>
          Start seller application
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  )
}
