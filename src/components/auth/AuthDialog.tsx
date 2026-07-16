'use client'

/**
 * V17 — Auth modal.
 *
 * Full-screen Radix Dialog that hosts a Login / Signup split-screen
 * layout. Modeled on the Untitled UI "split-image" pattern but built
 * from shadcn/ui primitives so we don't depend on a paid component pack.
 *
 * Left column: themed form (Login or Sign up, with a Framer Motion
 *   crossfade between them).
 * Right column (desktop only): branded hero image with a lime-tinted
 *   overlay and tagline.
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
import { Check, Eye, EyeOff, Loader2, MailCheck, ShieldCheck, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'

import { login, signup, checkUsernameAvailability, resendConfirmationEmail } from '@/lib/actions/auth'
import { stashPendingSignupAvatar } from '@/lib/auth/pending-avatar'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-[80] bg-bg-base/70 backdrop-blur-md"
              />
            </Dialog.Overlay>

            {/* Centering wrapper is a PLAIN div (pointer-events-none so clicks
                pass through to the overlay). Dialog.Content is the modal box
                ITSELF (the inner motion.div) so Radix correctly distinguishes
                inside vs. outside — making overlay-click, Escape, and the close
                button all dismiss properly. */}
            <div className="fixed inset-0 z-[81] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
              <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 16 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  // V17d — Container is the single gradient surface.
                  // The form panel + hero panel both sit on top of it
                  // transparently, so the previously-visible seam at
                  // the 50% split is gone — color flows continuously
                  // from the deep-black left edge through to the lime
                  // wash on the right.
                  'pointer-events-auto relative flex w-full overflow-hidden rounded-lg border border-border-default shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]',
                  'h-[min(92vh,720px)] max-w-[1080px]',
                )}
                style={{
                  // Two layered gradients on the modal itself:
                  //   1. A wide radial lime wash anchored at the
                  //      bottom-right corner — bleeds left into the
                  //      form area so the right panel doesn't read as
                  //      a separate slab.
                  //   2. A subtle diagonal lift from top-left so the
                  //      form panel isn't pure flat black.
                  // Both sit on top of the modal's bg-bg-base color so
                  // the gradient never washes out the form contrast.
                  backgroundColor: 'rgb(10 10 13)',
                  backgroundImage:
                    'radial-gradient(900px 600px at 100% 100%, rgba(198,255,61,0.13), transparent 65%),' +
                    'radial-gradient(700px 500px at 0% 0%, rgba(255,255,255,0.025), transparent 60%)',
                }}
              >
                <Dialog.Title className="sr-only">
                  {pendingVerifyEmail
                    ? 'Confirm your email address'
                    : mode === 'login'
                      ? 'Sign in to DropMarket'
                      : 'Create your DropMarket account'}
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
                    asChild motion.div Content. Deterministic. */}
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => onOpenChange(false)}
                  className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-base/60 text-text-secondary backdrop-blur-md transition-colors hover:border-border-default hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Left — form panel */}
                <div className="flex w-full flex-col overflow-y-auto md:w-1/2">
                  <AnimatePresence mode="wait">
                    {pendingVerifyEmail ? (
                      <motion.div
                        key="verify-email"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18 }}
                        className="flex min-h-full flex-col justify-center px-6 py-10 sm:px-10 sm:py-12"
                      >
                        <VerifyEmailView
                          email={pendingVerifyEmail}
                          onBackToLogin={() => {
                            setPendingVerifyEmail(null)
                            onModeChange('login')
                          }}
                        />
                      </motion.div>
                    ) : mode === 'login' ? (
                      <motion.div
                        key="login"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        className="flex min-h-full flex-col justify-center px-6 py-10 sm:px-10 sm:py-12"
                      >
                        <LoginForm
                          onSuccess={handleAuthSuccess}
                          onSwitchToSignup={() => onModeChange('signup')}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="signup"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18 }}
                        className="flex min-h-full flex-col justify-center px-6 py-10 sm:px-10 sm:py-12"
                      >
                        <SignupForm
                          onSuccess={handleAuthSuccess}
                          onSwitchToLogin={() => onModeChange('login')}
                          onRequiresConfirmation={setPendingVerifyEmail}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right — hero image panel (desktop only) */}
                <HeroPanel mode={mode} />
              </motion.div>
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
      className="relative hidden w-1/2 overflow-hidden md:block"
    >
      {/* V17d — Hero is now transparent over the container's shared
          gradient. The background image is dialed way down (opacity
          0.18 + heavy darkening) so it reads as a faint texture, not
          a separate panel surface. Without this, the panel's own
          dark fill would re-introduce the vertical seam we just got
          rid of. */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.18] mix-blend-luminosity"
        style={{
          backgroundImage: 'url(/section-bg/popular-games.jpg)',
        }}
      />
      {/* Soft edge wash — fades the LEFT edge of the hero into
          transparency so there's no boundary line where the panel
          starts. The rest of the lime tint is supplied by the
          container's bottom-right radial gradient. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(10,10,13,0.65) 0%, transparent 22%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10">
        {/* Top — logo */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-lime.png" alt="DropMarket" width={36} height={36} className="h-9 w-9 shrink-0" />
          <span className="text-lg font-bold tracking-tight text-text-primary">
            Drop<span className="text-lime-text">Market</span>
          </span>
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
              <h2 className="text-[36px] font-black leading-[1.05] tracking-tight text-text-primary">
                {mode === 'login' ? (
                  <>
                    Welcome back.<br />
                    <span className="text-lime-text">Game more. Grind less.</span>
                  </>
                ) : (
                  <>
                    Buy & sell game assets safely.<br />
                    <span className="text-lime-text">Safe, fast, fair trades.</span>
                  </>
                )}
              </h2>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-text-secondary">
                {mode === 'login'
                  ? 'Pick up where you left off — your orders, wishlist, and seller tools are right where you left them.'
                  : 'Every order is covered by SafeDrop Buyer Protection. Buy in 60 seconds, sell with peace of mind.'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom — trust strip */}
        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base/40 px-4 py-2.5 backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 shrink-0 text-lime-text" />
          <span className="text-[12.5px] text-text-secondary">
            Covered by{' '}
            <span className="font-semibold text-text-primary">SafeDrop</span> Buyer Protection
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
    <div className="mx-auto w-full max-w-sm space-y-5">
      {/* V17d — Form heading is now a quiet subhead. The right hero
          panel carries the visual "title" (Welcome back. Game more.
          Grind less.), so this side just labels the form. Smaller
          weight + uppercase tracking reads as an eyebrow rather than
          a competing title. */}
      <header className="space-y-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
          Sign in
        </p>
        <h2 className="text-[18px] font-semibold leading-snug tracking-tight text-text-primary">
          Continue to your account
        </h2>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={loading}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-[12px] text-error">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auth-password">Password</Label>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
              {...register('password')}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-text-tertiary transition-colors hover:text-text-primary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[12px] text-error">{errors.password.message}</p>
          )}
          <div className="flex justify-end pt-0.5">
            <a
              href="/forgot-password"
              className="text-[12.5px] font-medium text-lime-text transition-colors hover:text-lime"
            >
              Forgot Password?
            </a>
          </div>
        </div>

        {error && (
          <div className="space-y-2.5 rounded-lg border border-error/30 bg-error-bg px-3 py-2.5 text-[13px] text-error">
            <p>{error}</p>
            {unconfirmedEmail && <ResendConfirmationButton email={unconfirmedEmail} />}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full gap-2 bg-lime text-text-inverse hover:bg-lime-hover disabled:opacity-80"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <p className="text-center text-[13px] text-text-secondary">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-semibold text-lime-text transition-colors hover:text-lime"
        >
          Sign up
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
     • fullName (optional), confirmPassword, referralCode fields —
       all flow into the signup() server action so they're persisted
       to the profile (avatar/full_name) or the referral system at
       account creation. Settings reads these later.
   The form scrolls inside the modal panel when it overflows the
   modal height (the parent flex column has overflow-y-auto).
   ────────────────────────────────────────────────────────────────── */

const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'At least 3 characters')
      .max(24, 'Max 24 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscores, hyphens'),
    fullName: z.string().max(80, 'Too long').optional().or(z.literal('')),
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
    if (usernameStatus === 'taken') {
      setError('That username is already taken. Pick another.')
      return
    }
    setError(null)
    setLoading(true)
    try {
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
        username: data.username,
        fullName: data.fullName || undefined,
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
    <div className="mx-auto w-full max-w-sm space-y-5">
      {/* V17d — Eyebrow + quiet subhead. The hero on the right is the
          loud title ("Join 50,000+ gamers"); this side just labels
          the form so the two halves balance instead of competing. */}
      <header className="space-y-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
          Sign up
        </p>
        <h2 className="text-[18px] font-semibold leading-snug tracking-tight text-text-primary">
          Create your account
        </h2>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Avatar — sits at the top, optional. Falls back to a
            dicebear avataaars character seeded by the username so the
            preview updates as the user types their name. */}
        <div className="flex justify-center pb-1">
          <AvatarUpload
            onChange={setAvatarFile}
            username={usernameValue || 'gamervault'}
            size="sm"
          />
        </div>

        {/* Username + Full name — side by side on sm+ */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="auth-username">Username</Label>
            <div className="relative">
              <Input
                id="auth-username"
                type="text"
                autoComplete="username"
                placeholder="gamervault"
                disabled={loading}
                {...register('username')}
                className="pr-9"
              />
              {/* Availability indicator — render only when we have a
                  resolved status so we don't flash icons on first paint. */}
              {usernameValue.length >= 3 && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && (
                    <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                  )}
                  {usernameStatus === 'available' && (
                    <Check className="h-4 w-4 text-lime-text" />
                  )}
                  {usernameStatus === 'taken' && (
                    <XCircle className="h-4 w-4 text-error" />
                  )}
                </div>
              )}
            </div>
            {errors.username ? (
              <p className="text-[12px] text-error">{errors.username.message}</p>
            ) : usernameStatus === 'taken' ? (
              <p className="text-[12px] text-error">Already taken</p>
            ) : usernameStatus === 'available' ? (
              <p className="text-[12px] text-lime-text">Available</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-fullname">
              Full name <span className="text-text-tertiary">(optional)</span>
            </Label>
            <Input
              id="auth-fullname"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              disabled={loading}
              {...register('fullName')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auth-signup-email">Email</Label>
          <Input
            id="auth-signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={loading}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-[12px] text-error">{errors.email.message}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="auth-signup-password">Password</Label>
            <div className="relative">
              <Input
                id="auth-signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                disabled={loading}
                {...register('password')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-text-tertiary transition-colors hover:text-text-primary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[12px] text-error">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-confirm-password">Confirm</Label>
            <div className="relative">
              <Input
                id="auth-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat password"
                disabled={loading}
                {...register('confirmPassword')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-text-tertiary transition-colors hover:text-text-primary"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-[12px] text-error">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        {/* Referral — hidden behind a toggle. Mirrors how Shopify /
            Stripe-style checkouts hide promo codes: low-key link by
            default, expands to a real input on click. */}
        {showReferral ? (
          <div className="space-y-1.5">
            <Label htmlFor="auth-referral">
              Referral code <span className="text-text-tertiary">(optional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="auth-referral"
                type="text"
                autoComplete="off"
                placeholder="JOH4F2A1"
                disabled={loading}
                {...register('referralCode')}
                className="uppercase tracking-widest"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowReferral(false)}
                className="text-[12px] text-text-tertiary transition-colors hover:text-text-secondary"
              >
                Hide
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowReferral(true)}
            className="text-[12.5px] text-text-tertiary underline-offset-2 transition-colors hover:text-text-secondary hover:underline"
          >
            Have a referral code?
          </button>
        )}

        {error && (
          <div className="rounded-lg border border-error/30 bg-error-bg px-3 py-2.5 text-[13px] text-error">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
          className="h-11 w-full gap-2 bg-lime text-text-inverse hover:bg-lime-hover disabled:opacity-80"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>

        <p className="text-center text-[11.5px] leading-relaxed text-text-tertiary">
          By creating an account you agree to our{' '}
          <a href="/legal/terms" className="underline hover:text-text-secondary">
            Terms
          </a>{' '}
          and{' '}
          <a href="/legal/privacy" className="underline hover:text-text-secondary">
            Privacy Policy
          </a>
          .
        </p>
      </form>

      <p className="text-center text-[13px] text-text-secondary">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-lime-text transition-colors hover:text-lime"
        >
          Sign in
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
   signInWithPassword bounces with "email not confirmed". Outline
   (grey-hover) styling on purpose — lime stays reserved for the
   primary CTA of each view, and here the primary action is clicking
   the link we already emailed.
   ────────────────────────────────────────────────────────────────── */

function VerifyEmailView({
  email, onBackToLogin,
}: {
  email: string
  onBackToLogin: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-sm space-y-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border-subtle bg-bg-base/60">
        <MailCheck className="h-5 w-5 text-lime-text" />
      </div>

      <header className="space-y-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
          Verify Email
        </p>
        <h2 className="text-[18px] font-semibold leading-snug tracking-tight text-text-primary">
          Check Your Inbox
        </h2>
      </header>

      <p className="text-[13.5px] leading-relaxed text-text-secondary">
        We sent a confirmation link to{' '}
        <span className="font-semibold text-text-primary">{email}</span>. Click it to activate
        your account.
      </p>

      <ResendConfirmationButton email={email} />

      <p className="text-center text-[13px] text-text-secondary">
        Already confirmed?{' '}
        <button
          type="button"
          onClick={onBackToLogin}
          className="font-semibold text-lime-text transition-colors hover:text-lime"
        >
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
    <Button
      type="button"
      variant="outline"
      onClick={handleResend}
      disabled={sending || cooldown > 0}
      // Explicit text color: the login flow renders this inside the error
      // box, whose text-error would otherwise cascade into the button.
      className="h-10 w-full gap-2 text-text-secondary hover:text-text-primary"
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
    </Button>
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
