'use client'

/**
 * V24 — Auth modal, "Forest Ledger" edition.
 *
 * Full-screen Radix Dialog that hosts a Login / Signup split-screen
 * layout restyled into the LIGHT world used by the seller application
 * (src/app/account/become-seller/_redesign): ivory canvas, paper
 * inputs, forest-green primary, lime reserved for tiny accents only.
 *
 * Left column: light form (Login or Sign up, CSS-staggered reveal).
 * Right column (desktop only): hero photo under a forest scrim with a
 *   white tagline and a SafeDrop glass chip.
 *
 * Controlled via the AuthDialogProvider context so any button anywhere
 * in the app can open it with `useAuthDialog().open('login' | 'signup')`.
 *
 * On success the modal closes and `router.refresh()` runs so server
 * components re-render with the new auth state. No window.location reload.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Eye, EyeOff, Loader2, MailCheck, ShieldCheck, X, XCircle , Dices } from 'lucide-react'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'

import { login, signup, checkUsernameAvailability, checkEmailAvailability, generateUniqueGamerTag, resendConfirmationEmail } from '@/lib/actions/auth'
import { generateGamerTag } from '@/lib/username/gamer-names'
import { stashPendingSignupAvatar } from '@/lib/auth/pending-avatar'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/* ──────────────────────────────────────────────────────────────────
   "Forest Ledger" palette — hardcoded locally, same values as the
   seller application (become-seller/_redesign/theme.ts). The Tailwind
   arbitrary classes below repeat these hexes as literals because the
   JIT compiler can't see interpolated strings; keep both in sync.
   Lime is RESERVED: tiny accents only — never fills or text blocks.
   ────────────────────────────────────────────────────────────────── */

const PALETTE = {
  ivory: '#FAFAF7', // canvas
  paper: '#FFFFFF', // cards / inputs
  forest: '#14432A', // primary
  forest2: '#1B5E3A', // hover / focus
  forest3: '#0F3320', // deepest shade
  lime: '#A3E635', // tiny accents ONLY
  ink: '#1A1D19', // primary text
  ink2: '#5B6157', // secondary text
  line: '#E4E5DE', // hairline borders
} as const

/* Shared light-world class recipes (all literal for Tailwind JIT). */
const inputCls =
  // text-base below sm keeps iOS from zooming the page on focus (16px rule).
  'h-11 rounded-xl border-[#E4E5DE] bg-white px-4 text-base text-[#1A1D19] placeholder:text-[#5B6157]/55 transition-[border-color,box-shadow] duration-150 focus-visible:border-[#1B5E3A] focus-visible:ring-2 focus-visible:ring-[#1B5E3A]/[0.18] focus-visible:ring-offset-0 sm:text-sm'
const labelCls = 'text-[13px] font-medium text-[#1A1D19]'
const eyebrowCls = 'text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#1B5E3A]'
const headingCls = 'text-[26px] font-bold leading-tight tracking-tight text-[#1A1D19]'
const fieldErrorCls = 'text-[12px] text-[#B91C1C]'
const errorBoxCls =
  'rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-[13px] text-[#B91C1C]'
const linkCls = 'font-semibold text-[#1B5E3A] transition-colors hover:text-[#14432A]'
const switchLineCls = 'text-center text-[13px] text-[#5B6157]'
const eyeBtnCls =
  'absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B6157] transition-colors hover:text-[#1A1D19]'
const ctaCls =
  'auth-cta flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white'

/* ──────────────────────────────────────────────────────────────────
   Context
   ────────────────────────────────────────────────────────────────── */

type AuthMode = 'login' | 'signup'

interface AuthDialogOpenOpts {
  /** Where to send the user after a successful login/signup.
   *  Defaults to staying on the current page (just refresh). */
  redirect?: string
}

interface AuthDialogContextValue {
  open: (mode?: AuthMode, opts?: AuthDialogOpenOpts) => void
  close: () => void
  isOpen: boolean
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null)

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext)
  if (!ctx) {
    throw new Error('useAuthDialog must be used inside <AuthDialogProvider>')
  }
  return ctx
}

/* ──────────────────────────────────────────────────────────────────
   Provider + Dialog shell
   ────────────────────────────────────────────────────────────────── */

export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  // V17 — Caller-supplied post-auth redirect target. Lives in a ref so
  // updates between renders never re-trigger the dialog effect chain.
  const redirectRef = useRef<string | null>(null)

  const open = useCallback((next: AuthMode = 'login', opts?: AuthDialogOpenOpts) => {
    setMode(next)
    redirectRef.current = opts?.redirect ?? null
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <AuthDialogContext.Provider value={{ open, close, isOpen }}>
      {children}
      <AuthDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        mode={mode}
        onModeChange={setMode}
        redirectRef={redirectRef}
      />
    </AuthDialogContext.Provider>
  )
}

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  redirectRef: MutableRefObject<string | null>
}

function AuthDialog({ open, onOpenChange, mode, onModeChange, redirectRef }: AuthDialogProps) {
  const router = useRouter()

  // V23 — Email-confirmation mode (Supabase "Confirm email" ON). When the
  // signup action reports requiresEmailConfirmation, we swap the form panel
  // for a "Check Your Inbox" view holding the address we mailed. Cleared
  // whenever the dialog closes so a reopen always starts on a form.
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setPendingVerifyEmail(null)
  }, [open])

  // V22 — Auth state is now a single shared context (AuthProvider). The
  // login/signup forms already call supabase.auth.refreshSession() before
  // onSuccess(), which broadcasts SIGNED_IN → the shared context updates the
  // navbar synchronously. So on success we simply close the modal: no
  // "finalizing" overlay that waits for useAuth to catch up (that was a
  // workaround for the old per-hook auth and is what stranded the modal on
  // "Signing you in…" while the navbar had already flipped to the avatar).
  const handleAuthSuccess = useCallback(() => {
    const redirect = redirectRef.current
    redirectRef.current = null

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }

    // Beta A — Navigate BEFORE closing the modal. If we close first, the
    // /login bounce effect can observe isOpen=false while pathname is still
    // '/login' (App Router navigation commits async) and issue a competing
    // router.replace('/') — two simultaneous replaces mid-portal-unmount were
    // the Pixel client-side exception. Issuing our navigation first shrinks
    // that window; the /login effect's `!user` guard closes it entirely.
    if (redirect) {
      router.replace(redirect)
    } else {
      router.refresh()
    }

    // Close the modal — the navbar is already updated via the SIGNED_IN broadcast.
    onOpenChange(false)
  }, [onOpenChange, redirectRef, router])

  return (
    <>
    {/* V24 — Bespoke CSS motion (Apple-calm). All entrances are CSS, not
        framer: rAF can stall in throttled contexts and freeze a JS-driven
        overlay/panel mid-fade. Everything is gated behind
        prefers-reduced-motion so reduced-motion users get instant paints. */}
    <style jsx global>{`
      @media (prefers-reduced-motion: no-preference) {
        .auth-overlay-in {
          animation: authFadeIn 200ms ease-out both;
        }
        .auth-panel-in {
          animation: authPanelIn 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-reveal {
          animation: authReveal 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-reveal-1 {
          animation-delay: 60ms;
        }
        .auth-reveal-2 {
          animation-delay: 120ms;
        }
        .auth-reveal-3 {
          animation-delay: 180ms;
        }
        .auth-photo-settle {
          animation: authPhotoSettle 1100ms ease-out both;
        }
      }
      @keyframes authFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes authPanelIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes authReveal {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes authPhotoSettle {
        from {
          opacity: 0;
          transform: scale(1.08);
        }
        to {
          /* Bright where the art lives — the DIRECTIONAL scrims (not a
             uniform dim) darken only the text/edge zones, hero-style. */
          opacity: 0.9;
          transform: scale(1.02);
        }
      }
      /* Primary CTA — forest with a subtle 3D press; lime appears only as a
         1px inner top light on hover (reserved-accent rule). */
      .auth-cta {
        background-color: #14432a;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.16),
          inset 0 -2px 0 rgba(0, 0, 0, 0.28),
          0 12px 24px -12px rgba(15, 51, 32, 0.5);
        transition:
          background-color 150ms ease,
          box-shadow 150ms ease,
          transform 150ms ease,
          opacity 150ms ease;
      }
      .auth-cta:hover:not(:disabled) {
        background-color: #1b5e3a;
        box-shadow:
          inset 0 1px 0 rgba(163, 230, 53, 0.35),
          inset 0 -2px 0 rgba(0, 0, 0, 0.28),
          0 12px 24px -12px rgba(15, 51, 32, 0.5);
      }
      .auth-cta:active:not(:disabled) {
        transform: translateY(1px);
      }
      .auth-cta:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      /* Light-world overrides for the shared AvatarUpload (its own styling
         is dark-world). Scoped to the auth modal wrapper only. */
      .auth-avatar-light div.cursor-pointer.rounded-full {
        border-color: #e4e5de !important;
        background-color: #ffffff !important;
      }
      .auth-avatar-light div.cursor-pointer.rounded-full:hover {
        border-color: #c9ccc0 !important;
      }
      .auth-avatar-light > div > button[type='button'] {
        background-color: #ffffff !important;
        color: #1a1d19 !important;
        border: 1px solid #e4e5de !important;
        box-shadow: none !important;
        text-transform: capitalize; /* "Upload picture" → "Upload Picture" */
      }
      .auth-avatar-light > div > button[type='button']:hover {
        background-color: #fafaf7 !important;
      }
    `}</style>
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              {/* CSS entrance, not framer: rAF can stall in throttled
                  contexts and freeze the overlay+panel mid-fade. */}
              <div className="auth-overlay-in fixed inset-0 z-[80] bg-[rgba(15,51,32,0.5)] backdrop-blur-md" />
            </Dialog.Overlay>

            {/* Centering wrapper is a PLAIN div (pointer-events-none so clicks
                pass through to the overlay). Dialog.Content is the modal box
                ITSELF (the inner div) so Radix correctly distinguishes
                inside vs. outside — making overlay-click, Escape, and the close
                button all dismiss properly. */}
            <div className="fixed inset-0 z-[81] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
              <Dialog.Content asChild>
              <div
                className={cn(
                  'auth-panel-in',
                  // V24 — Forest Ledger panel: ivory surface, deep forest
                  // drop shadow, no visible border. The hero photo pane
                  // supplies the dark half; the ivory canvas carries the form.
                  'pointer-events-auto relative flex w-full overflow-hidden rounded-2xl bg-[#FAFAF7] shadow-[0_32px_80px_-20px_rgba(15,51,32,0.55)]',
                  // Mobile: content-driven height capped to the DYNAMIC
                  // viewport (dvh) so iOS Safari's URL bar never clips the
                  // dialog edges; the fixed two-panel height only applies
                  // at md+ where the hero panel needs it. The form panel
                  // has overflow-y-auto, so tall forms scroll internally.
                  'max-h-[min(92dvh,720px)] md:h-[min(92dvh,680px)] max-w-[1000px]',
                )}
              >
                <Dialog.Title className="sr-only">
                  {pendingVerifyEmail
                    ? 'Confirm Your Email'
                    : mode === 'login'
                      ? 'Sign In To DropMarket'
                      : 'Create Your DropMarket Account'}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {pendingVerifyEmail
                    ? 'We sent a confirmation link to your email. Click it to activate your account.'
                    : mode === 'login'
                      ? 'Enter your email and password to access your account.'
                      : 'Sign up to start buying and selling on DropMarket.'}
                </Dialog.Description>

                {/* Close button — wired DIRECTLY to onOpenChange (the same
                    dismiss path outside-click uses) rather than Dialog.Close
                    asChild, which didn't fire reliably when nested inside the
                    asChild Content. Deterministic. One responsive button:
                    ink ghost over the ivory pane below md, white ghost over
                    the photo at md+. */}
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => onOpenChange(false)}
                  className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full text-[#5B6157] transition-colors hover:bg-black/5 hover:text-[#1A1D19] md:bg-white/[0.12] md:text-white md:backdrop-blur-md md:hover:bg-white/[0.22] md:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Left — form panel */}
                <div className="flex w-full flex-col overflow-y-auto md:w-1/2">
                  {/* Mobile brand — the hero pane (and its lockup) is md+. */}
                  <div className="flex items-center justify-center gap-2 pt-7 md:hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/logo-mark-ink.png" alt="" className="h-7 w-7 object-contain" />
                    <span className="text-[18px] font-bold tracking-tight" style={{ color: PALETTE.forest }}>
                      DropMarket
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    {pendingVerifyEmail ? (
                      <div
                        key="verify-email"
                        className="flex min-h-full flex-col px-6 py-8 sm:px-8 sm:py-9 md:px-10"
                      >
                        <VerifyEmailView
                          email={pendingVerifyEmail}
                          onBackToLogin={() => {
                            setPendingVerifyEmail(null)
                            onModeChange('login')
                          }}
                        />
                      </div>
                    ) : mode === 'login' ? (
                      <div
                        key="login"
                        className="flex min-h-full flex-col px-6 py-8 sm:px-8 sm:py-9 md:px-10"
                      >
                        <LoginForm
                          onSuccess={handleAuthSuccess}
                          onSwitchToSignup={() => onModeChange('signup')}
                        />
                      </div>
                    ) : (
                      <div
                        key="signup"
                        className="flex min-h-full flex-col px-6 py-8 sm:px-8 sm:py-9 md:px-10"
                      >
                        <SignupForm
                          onSuccess={handleAuthSuccess}
                          onSwitchToLogin={() => onModeChange('login')}
                          onRequiresConfirmation={setPendingVerifyEmail}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right — hero image panel (desktop only) */}
                <HeroPanel mode={mode} />

              </div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
    </>
  )
}

/* ──────────────────────────────────────────────────────────────────
   Hero panel
   ────────────────────────────────────────────────────────────────── */

function HeroPanel({ mode }: { mode: AuthMode }) {
  return (
    <div
      aria-hidden
      className="relative hidden overflow-hidden md:block md:w-1/2"
      style={{ backgroundColor: PALETTE.forest3 }}
    >
      {/* Hero photo — slow settle on mount, CSS only.
          Swap public/auth/hero.png to change this artwork (any PNG/JPG
          renamed to hero.png works; transparent cutouts float over the
          deep-forest base). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/auth/hero.png"
        alt=""
        className="auth-photo-settle absolute inset-0 h-full w-full object-cover"
      />
      {/* Directional scrims, hero-style: dark at the seam edge + the
          bottom text zone + a thin top strip (logo/close contrast), a
          corner vignette, and a light flat brand tint — the upper-right,
          where the art lives, stays bright. */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(to right, rgba(15,51,32,0.85) 0%, rgba(15,51,32,0.35) 30%, rgba(15,51,32,0.06) 58%, transparent 75%)',
            'linear-gradient(to top, rgba(15,51,32,0.92) 0%, rgba(15,51,32,0.45) 28%, transparent 58%)',
            'linear-gradient(to bottom, rgba(15,51,32,0.5) 0%, transparent 20%)',
            'radial-gradient(135% 105% at 72% 30%, transparent 58%, rgba(15,51,32,0.45) 100%)',
            'linear-gradient(rgba(15,51,32,0.14), rgba(15,51,32,0.14))',
          ].join(', '),
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10">
        {/* Top — white brand lockup, centered. Plain mark + wordmark
            (no chip); the thin top scrim keeps it readable on any art. */}
        <div className="flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-mark-white.png"
            alt="DropMarket"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="text-[22px] font-bold tracking-tight text-white">DropMarket</span>
        </div>

        {/* Middle — tagline */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-[35px] font-black leading-[1.08] tracking-tight text-white">
                {mode === 'login' ? (
                  <>
                    Welcome Back.<br />
                    {/* The ONE permitted lime accent — a single short phrase. */}
                    <span style={{ color: 'rgba(163,230,53,0.9)' }}>The Grind Ends Here.</span>
                  </>
                ) : (
                  <>
                    Join DropMarket.<br />
                    <span style={{ color: 'rgba(163,230,53,0.9)' }}>Buy. Sell. Level Up.</span>
                  </>
                )}
              </h2>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
                {mode === 'login'
                  ? 'Everything’s right where you left it.'
                  : 'Every order covered by SafeDrop Buyer Protection.'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom — SafeDrop glass chip */}
        <div className="flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: PALETTE.lime }} />
          <span className="text-[13px] text-white/90">
            Covered by <span className="font-semibold text-white">SafeDrop</span> Buyer Protection
          </span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   Login form
   ────────────────────────────────────────────────────────────────── */

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginData = z.infer<typeof loginSchema>

function LoginForm({
  onSuccess, onSwitchToSignup,
}: {
  onSuccess: () => void
  onSwitchToSignup: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // V23 — When login fails because the email was never confirmed (Supabase
  // "Confirm email" mode), we keep the address around so the error box can
  // offer a one-click resend of the confirmation link.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginData) => {
    setError(null)
    setUnconfirmedEmail(null)
    setLoading(true)
    try {
      const result = await login({ email: data.email, password: data.password })
      if (result.error) {
        setError(result.error)
        if ('needsConfirmation' in result && result.needsConfirmation) {
          setUnconfirmedEmail(data.email)
        }
        setLoading(false)
        return
      }
      // V17d — The server action set the auth cookie, but the CLIENT
      // supabase instance is still holding its old "no session" state.
      // Without forcing a sync here, useAuth() in the navbar never
      // sees a SIGNED_IN event and the modal hits its safety timeout
      // instead of resolving on the real auth signal.
      //
      // refreshSession() reads the new cookie, hydrates the client
      // session store, AND broadcasts SIGNED_IN to every existing
      // onAuthStateChange listener — that's what flips the navbar
      // from "Log in" to the avatar.
      const supabase = createClient()
      await supabase.auth.refreshSession().catch(() => {
        // Fallback if refresh fails — at least force a re-read so
        // the client picks up the cookie before we move on.
        return supabase.auth.getSession()
      })
      toast.success('Welcome back')
      // Reset the button state before handing off — don't rely on the modal
      // unmounting to hide a stuck "Signing in…" spinner.
      setLoading(false)
      onSuccess()
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto my-auto w-full max-w-[400px] space-y-4">
      <header className="auth-reveal space-y-1.5">
        <p className={eyebrowCls}>Sign In</p>
        <h2 className={headingCls}>Continue To Your Account</h2>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div className="auth-reveal auth-reveal-1 space-y-1.5">
          <Label htmlFor="auth-email" className={labelCls}>Email</Label>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={loading}
            {...register('email')}
            className={inputCls}
          />
          {errors.email && (
            <p className={fieldErrorCls}>{errors.email.message}</p>
          )}
        </div>

        <div className="auth-reveal auth-reveal-2 space-y-1.5">
          <Label htmlFor="auth-password" className={labelCls}>Password</Label>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
              {...register('password')}
              className={cn(inputCls, 'pr-12')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className={eyeBtnCls}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className={fieldErrorCls}>{errors.password.message}</p>
          )}
          <div className="flex justify-end pt-0.5">
            <a href="/forgot-password" className={cn('text-[13px]', linkCls)}>
              Forgot Password?
            </a>
          </div>
        </div>

        {error && (
          <div className={cn(errorBoxCls, 'space-y-2.5')}>
            <p>{error}</p>
            {unconfirmedEmail && <ResendConfirmationButton email={unconfirmedEmail} />}
          </div>
        )}

        <button type="submit" disabled={loading} className={cn(ctaCls, 'auth-reveal auth-reveal-3')}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing In…
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <p className={cn(switchLineCls, 'auth-reveal auth-reveal-3')}>
        Don&apos;t have an account?{' '}
        <button type="button" onClick={onSwitchToSignup} className={linkCls}>
          Sign Up
        </button>
      </p>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   Signup form — full version
   ─────────────────────────────────────────────────────────────────
   Brings the marquee features back from the old /signup page:
     • Avatar upload (optional) — default to a dicebear avatar seeded
       by username when none uploaded. AvatarUpload component handles
       both. We send the chosen image to the signup server action as
       base64; the action uploads it to storage and writes avatar_url
       on the profile row.
     • Live username availability check — debounced 600ms after the
       last keystroke, with checking / available / taken pill states.
     • firstName/lastName (required, joined into full_name),
       optional Display Username (empty → random free gamer tag),
       confirmPassword, referralCode fields —
       all flow into the signup() server action so they're persisted
       to the profile (avatar/full_name) or the referral system at
       account creation. Settings reads these later.
   The form scrolls inside the modal panel when it overflows the
   modal height (the parent flex column has overflow-y-auto).
   ────────────────────────────────────────────────────────────────── */

const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Required').max(40, 'Too long'),
    lastName: z.string().trim().min(1, 'Required').max(40, 'Too long'),
    // Optional: empty = we assign a random gamer tag server-side.
    username: z
      .string()
      .max(24, 'Max 24 characters')
      .regex(/^$|^[a-zA-Z0-9_-]{3,}$/, 'At least 3 characters — letters, numbers, underscores, hyphens')
      .optional()
      .or(z.literal('')),
    email: z.string().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[0-9]/, 'Add a number'),
    confirmPassword: z.string(),
    referralCode: z.string().max(16, 'Too long').optional().or(z.literal('')),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type SignupData = z.infer<typeof signupSchema>

type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken'

function SignupForm({
  onSuccess, onSwitchToLogin, onRequiresConfirmation,
}: {
  onSuccess: () => void
  onSwitchToLogin: () => void
  /** Email-confirmation mode: swap the dialog to the "Check Your Inbox" view. */
  onRequiresConfirmation: (email: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const usernameCheckIdRef = useRef(0)
  // V17c — Referral field is collapsed behind a small toggle so it
  // doesn't draw attention away from the primary fields. Discount-code
  // pattern from e-commerce checkouts: invisible unless you have one.
  const [showReferral, setShowReferral] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
  })

  // Watch the username so the avatar preview can seed the dicebear
  // image and the availability check can debounce against keystrokes.
  const usernameValue = watch('username') || ''

  // Debounced username availability check. Uses a check-id counter so
  // out-of-order responses (slow request finishing after a fast one)
  // don't clobber the latest status. Skips when the format is invalid
  // so we don't fire a network call for "ab" or "abc!".
  useEffect(() => {
    if (!usernameValue || usernameValue.length < 3) {
      setUsernameStatus('idle')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(usernameValue)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    const myId = ++usernameCheckIdRef.current
    const t = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(usernameValue)
        if (myId !== usernameCheckIdRef.current) return
        setUsernameStatus(result.available ? 'available' : 'taken')
      } catch {
        if (myId !== usernameCheckIdRef.current) return
        setUsernameStatus('idle')
      }
    }, 600)
    return () => clearTimeout(t)
  }, [usernameValue])

  const onSubmit = async (data: SignupData) => {
    if (data.username && usernameStatus === 'taken') {
      setError('That username is already taken. Pick another.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      // Honest duplicate check — Supabase signUp fakes success for emails
      // that already exist (anti-enumeration), which read as a silent
      // no-op to the user. Surface it as a real error with a sign-in path.
      const emailCheck = await checkEmailAvailability(data.email)
      if (!emailCheck.available) {
        setError('EMAIL_TAKEN')
        setLoading(false)
        return
      }

      // Username is optional: an empty field gets a random free gamer tag
      // (SilentRaptor42-style) which becomes the display name everywhere.
      let username = data.username?.trim() || ''
      if (!username) {
        const generated = await generateUniqueGamerTag()
        username = generated.username
      }

      // Convert any uploaded avatar to base64 — the server action
      // splits the data-uri, uploads the binary half to storage, and
      // writes the resulting public URL onto the profile row. If no
      // avatar was uploaded the trigger-created profile keeps its
      // username-seeded dicebear default (handled elsewhere).
      let avatarData: string | undefined
      if (avatarFile) {
        avatarData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(avatarFile)
        })
      }

      const result = await signup({
        email: data.email,
        password: data.password,
        username,
        fullName: `${data.firstName.trim()} ${data.lastName.trim()}`,
        avatarData,
        referralCode: data.referralCode || undefined,
      })
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      // V23 — Supabase "Confirm email" mode: the account exists but there is
      // no session until the user clicks the emailed link. No client session
      // to sync, no success toast — show the "Check Your Inbox" view instead.
      if ('requiresEmailConfirmation' in result && result.requiresEmailConfirmation) {
        // Beta A — There's no session yet to upload the avatar into, so stash
        // it locally; use-auth flushes it via uploadProfileAvatar() on the
        // first authenticated session. A stash failure must never block the
        // verify-email view, so swallow any error.
        if (avatarData) {
          try {
            await stashPendingSignupAvatar(data.email, avatarData)
          } catch {
            // non-critical — user can re-upload from /account/settings
          }
        }
        setLoading(false)
        onRequiresConfirmation(data.email)
        return
      }
      // V17d — Same client-session sync as the login path. The
      // server set the cookie; refreshSession() makes the client
      // supabase pick it up and emit SIGNED_IN to every listener.
      const supabase = createClient()
      await supabase.auth.refreshSession().catch(() => {
        return supabase.auth.getSession()
      })
      toast.success('Account created — welcome to DropMarket!')
      setLoading(false)
      onSuccess()
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto my-auto w-full max-w-[400px] space-y-4">
      <header className="auth-reveal space-y-1.5">
        <p className={eyebrowCls}>Sign Up</p>
        <h2 className={headingCls}>Create Your Account</h2>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Industry-standard order: name → username → email → password.
            First/Last are required; the avatar moved to a compact
            optional row above the CTA. */}
        <div className="auth-reveal auth-reveal-1 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="auth-firstname" className={labelCls}>First Name</Label>
            <Input
              id="auth-firstname"
              type="text"
              autoComplete="given-name"
              placeholder="Jane"
              disabled={loading}
              {...register('firstName')}
              className={inputCls}
            />
            {errors.firstName && (
              <p className={fieldErrorCls}>{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-lastname" className={labelCls}>Last Name</Label>
            <Input
              id="auth-lastname"
              type="text"
              autoComplete="family-name"
              placeholder="Doe"
              disabled={loading}
              {...register('lastName')}
              className={inputCls}
            />
            {errors.lastName && (
              <p className={fieldErrorCls}>{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Display Username — optional. Empty = we assign a random free
            gamer tag at signup (Eldorado-style) and it becomes the name
            shown on orders, reviews and the shop. The dice button rolls
            a suggestion client-side; the availability check still runs. */}
        <div className="auth-reveal auth-reveal-1 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
          <Label htmlFor="auth-username" className={labelCls}>
            Display Username <span className="font-normal text-[#5B6157]">(optional)</span>
          </Label>
          <div className="relative">
            <Input
              id="auth-username"
              type="text"
              autoComplete="username"
              placeholder="Optional"
              disabled={loading}
              {...register('username')}
              className={cn(inputCls, 'pr-20')}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {usernameValue.length >= 3 && (
                <span className="grid h-9 w-6 place-items-center">
                  {usernameStatus === 'checking' && (
                    <Loader2 className="h-4 w-4 animate-spin text-[#5B6157]" />
                  )}
                  {usernameStatus === 'available' && (
                    <Check className="h-4 w-4 text-[#1B5E3A]" />
                  )}
                  {usernameStatus === 'taken' && (
                    <XCircle className="h-4 w-4 text-[#B91C1C]" />
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={() => setValue('username', generateGamerTag(), { shouldValidate: true, shouldDirty: true })}
                disabled={loading}
                aria-label="Roll a random gamer tag"
                title="Roll a random gamer tag"
                className="grid h-9 w-9 place-items-center rounded-lg text-[#5B6157] transition-colors hover:bg-[#F4F5EE] hover:text-[#14432A]"
              >
                <Dices className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          {errors.username ? (
            <p className={fieldErrorCls}>{errors.username.message}</p>
          ) : usernameStatus === 'taken' ? (
            <p className={fieldErrorCls}>Already taken</p>
          ) : usernameStatus === 'available' ? (
            <p className="text-[12px] text-[#1B5E3A]">Available</p>
          ) : null}
          </div>

          <div className="space-y-1.5">
          <Label htmlFor="auth-signup-email" className={labelCls}>Email</Label>
          <Input
            id="auth-signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={loading}
            {...register('email')}
            className={inputCls}
          />
          {errors.email && (
            <p className={fieldErrorCls}>{errors.email.message}</p>
          )}
          </div>
        </div>

        <div className="auth-reveal auth-reveal-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="auth-signup-password" className={labelCls}>Password</Label>
            <div className="relative">
              <Input
                id="auth-signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                disabled={loading}
                {...register('password')}
                className={cn(inputCls, 'pr-12')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className={eyeBtnCls}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className={fieldErrorCls}>{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-confirm-password" className={labelCls}>Confirm</Label>
            <div className="relative">
              <Input
                id="auth-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat password"
                disabled={loading}
                {...register('confirmPassword')}
                className={cn(inputCls, 'pr-12')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className={eyeBtnCls}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className={fieldErrorCls}>{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        {/* Profile picture — compact optional row, moved down from the
            top of the form. The dicebear preview seeds from the typed
            username; a skipped upload can always be added in Settings. */}
        <div className="auth-avatar-light auth-reveal auth-reveal-3 flex items-center gap-3 rounded-xl border border-[#E4E5DE] bg-white px-3.5 py-2">
          <AvatarUpload
            onChange={setAvatarFile}
            username={usernameValue || 'gamervault'}
            size="sm"
          />
        </div>

        {/* Referral — hidden behind a toggle. Mirrors how Shopify /
            Stripe-style checkouts hide promo codes: low-key link by
            default, expands to a real input on click. */}
        {showReferral ? (
          <div className="auth-reveal auth-reveal-3 space-y-1.5">
            <Label htmlFor="auth-referral" className={labelCls}>
              Referral Code <span className="font-normal text-[#5B6157]">(optional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="auth-referral"
                type="text"
                autoComplete="off"
                placeholder="JOH4F2A1"
                disabled={loading}
                {...register('referralCode')}
                className={cn(inputCls, 'uppercase tracking-widest')}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowReferral(false)}
                className="text-[12px] text-[#5B6157] transition-colors hover:text-[#1A1D19]"
              >
                Hide
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowReferral(true)}
            className="auth-reveal auth-reveal-3 text-[12.5px] font-medium text-[#1B5E3A] underline-offset-2 transition-colors hover:text-[#14432A] hover:underline"
          >
            Have a Referral Code?
          </button>
        )}

        {error && (
          <div className={errorBoxCls}>
            {error === 'EMAIL_TAKEN' ? (
              <>
                This email is already registered.{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-semibold underline underline-offset-2"
                >
                  Sign In Instead
                </button>
              </>
            ) : (
              error
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (usernameValue.length >= 3 && (usernameStatus === 'taken' || usernameStatus === 'checking'))}
          className={cn(ctaCls, 'auth-reveal auth-reveal-3')}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Account…
            </>
          ) : (
            'Create Account'
          )}
        </button>

        <p className="auth-reveal auth-reveal-3 text-center text-[12px] leading-relaxed text-[#5B6157]">
          By creating an account you agree to our{' '}
          <a href="/legal/terms" className="text-[#1B5E3A] underline transition-colors hover:text-[#14432A]">
            Terms
          </a>{' '}
          and{' '}
          <a href="/legal/privacy" className="text-[#1B5E3A] underline transition-colors hover:text-[#14432A]">
            Privacy Policy
          </a>
          .
        </p>
      </form>

      <p className={cn(switchLineCls, 'auth-reveal auth-reveal-3')}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className={linkCls}>
          Sign In
        </button>
      </p>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   Verify-email view + resend button
   ─────────────────────────────────────────────────────────────────
   V23 — Shown in place of the forms when Supabase "Confirm email" is
   ON and a fresh signup has no session yet. The resend button is the
   shared affordance: it also renders inside the login error box when
   signInWithPassword bounces with "email not confirmed". Quiet paper
   chip on purpose — forest stays reserved for the primary CTA of each
   view, and here the primary action is clicking the link we already
   emailed.
   ────────────────────────────────────────────────────────────────── */

function VerifyEmailView({
  email, onBackToLogin,
}: {
  email: string
  onBackToLogin: () => void
}) {
  return (
    <div className="mx-auto my-auto w-full max-w-[400px] space-y-4">
      <div
        className="auth-reveal flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(27,94,58,0.08)' }}
      >
        <MailCheck className="h-5 w-5 text-[#1B5E3A]" />
      </div>

      <header className="auth-reveal auth-reveal-1 space-y-1.5">
        <p className={eyebrowCls}>Confirm Your Email</p>
        <h2 className={headingCls}>Check Your Inbox</h2>
      </header>

      <p className="auth-reveal auth-reveal-2 text-[13.5px] leading-relaxed text-[#5B6157]">
        We sent a confirmation link to{' '}
        <span className="font-semibold text-[#1A1D19]">{email}</span>. Click it to activate
        your account.
      </p>

      <div className="auth-reveal auth-reveal-3">
        <ResendConfirmationButton email={email} />
      </div>

      <p className={cn(switchLineCls, 'auth-reveal auth-reveal-3')}>
        Already confirmed?{' '}
        <button type="button" onClick={onBackToLogin} className={linkCls}>
          Sign In
        </button>
      </p>
    </div>
  )
}

function ResendConfirmationButton({ email }: { email: string }) {
  const [sending, setSending] = useState(false)
  // Seconds left on the resend cooldown — 30s after each successful send so
  // the user can't hammer Supabase's email rate limit from the UI.
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleResend = async () => {
    if (sending || cooldown > 0) return
    setSending(true)
    try {
      const result = await resendConfirmationEmail(email)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCooldown(30)
      }
    } catch {
      toast.error('We could not resend the email. Please try again shortly.')
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={sending || cooldown > 0}
      // Explicit paper-chip styling: the login flow renders this inside the
      // light error box, whose red text would otherwise cascade in.
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#E4E5DE] bg-white text-[13px] font-medium text-[#1A1D19] transition-colors hover:bg-[#FAFAF7] disabled:pointer-events-none disabled:opacity-60"
    >
      {sending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Sending…
        </>
      ) : cooldown > 0 ? (
        `Sent — check spam too (${cooldown}s)`
      ) : (
        'Resend Email'
      )}
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────
   Hook for legacy /login and /signup pages to redirect into the modal
   ────────────────────────────────────────────────────────────────── */

export function useOpenAuthOnMount(mode: AuthMode, opts?: AuthDialogOpenOpts) {
  const { open } = useAuthDialog()
  // Pluck redirect into a local so the effect dep array stays stable.
  const redirect = opts?.redirect
  useEffect(() => {
    open(mode, redirect ? { redirect } : undefined)
  }, [mode, open, redirect])
}
