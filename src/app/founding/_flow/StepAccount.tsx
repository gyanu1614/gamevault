'use client'

/**
 * Step 1 — sign up or log in. Signed in → a tick and Continue. Signed out →
 * Google / Discord buttons, then email + password with a Log In / Sign Up
 * switch, reusing the auth actions (no new signup system). An
 * email-confirmation wait survives a refresh via safeSession
 * (lib/safe-storage); the confirmation link lands back on /founding, and so
 * does the OAuth round trip (`next=/founding`); a Google/Discord account that
 * has no password yet gets the site-wide Set Your Password modal over this
 * page (PasswordGate) before it can continue.
 */
import { useEffect, useState } from 'react'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { EnvelopeSimple } from '@phosphor-icons/react/dist/ssr/EnvelopeSimple'
import { login, signup, resendConfirmationEmail, checkEmailAvailability, generateUniqueGamerTag, logout } from '@/lib/actions/auth'
import { Field, FormError, INPUT_CLS, PrimaryButton, StepActions, StepCard, GhostButton } from './ui'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { safeSession } from '@/lib/safe-storage'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STORAGE_KEY = 'dm.founding.confirm'

type Mode = 'login' | 'signup'

/**
 * The server action set the auth cookie, but the browser's Supabase client is
 * still holding "no session" — the navbar's useAuth() never sees SIGNED_IN
 * until something hydrates it (same fix as AuthDialogBody V17d). refreshSession
 * reads the cookie and broadcasts to every onAuthStateChange listener.
 */
async function syncClientSession(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.refreshSession().catch(() => supabase.auth.getSession())
}

export function StepAccount({
  signedIn,
  email: signedInEmail,
  onContinue,
  onSignedIn,
}: {
  signedIn: boolean
  email: string | null
  onContinue: () => void
  onSignedIn: () => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // A pending "check your inbox" survives a reload.
  useEffect(() => {
    try {
      const raw = safeSession.get(STORAGE_KEY)
      const p = raw ? (JSON.parse(raw) as { email?: string }) : null
      if (p?.email && !signedIn) {
        setEmail(p.email)
        setConfirming(true)
      }
    } catch { /* malformed entry */ }
  }, [signedIn])
  useEffect(() => {
    if (confirming && email) safeSession.set(STORAGE_KEY, JSON.stringify({ email }))
    else safeSession.remove(STORAGE_KEY)
  }, [confirming, email])
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (signedIn) {
    return (
      <StepCard title="Signed Up" lead="This account will be your seller account.">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-lime-tint-bg text-lime-text">
            <Check weight="bold" className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-text-primary">{signedInEmail ?? 'Signed in'}</p>
            <p className="text-caption font-normal text-text-tertiary">Signed in</p>
          </div>
          <button
            type="button"
            onClick={() => { logout().catch(() => undefined) }}
            className="ml-auto text-body-sm text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Not you? Sign Out
          </button>
        </div>
        <StepActions>
          <PrimaryButton type="button" onClick={onContinue}>Continue</PrimaryButton>
        </StepActions>
      </StepCard>
    )
  }

  if (confirming) {
    return (
      <StepCard title="Check Your Inbox" lead={<>We sent a confirmation link to <span className="font-medium text-text-primary">{email}</span>. Open it and you&apos;ll land right back here.</>}>
        <div className="flex items-center gap-3">
          <EnvelopeSimple weight="duotone" className="h-6 w-6 shrink-0 text-text-secondary" aria-hidden />
          <p className="text-body-sm text-text-secondary">No email after a minute? Check spam, or send it again.</p>
        </div>
        <FormError message={error} />
        <StepActions onBack={() => { setConfirming(false); setError(null) }} backLabel="Use A Different Email">
          <GhostButton
            disabled={cooldown > 0}
            onClick={async () => {
              setCooldown(30)
              try { await resendConfirmationEmail(email) } catch { setError('Could not resend right now. Try again in a moment.') }
            }}
          >
            {cooldown > 0 ? `Resend In ${cooldown}s` : 'Resend Email'}
          </GhostButton>
          <PrimaryButton type="button" busy={busy} onClick={async () => { setBusy(true); await syncClientSession(); await onSignedIn(); setBusy(false) }}>
            I&apos;ve Confirmed
          </PrimaryButton>
        </StepActions>
      </StepCard>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Your password needs at least 8 characters.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const res = await login({ email, password })
        if (res?.error) return setError(res.error)
        await syncClientSession()
        await onSignedIn()
        return
      }
      const check = await checkEmailAvailability(email)
      if (!check.available) {
        setMode('login')
        return setError(check.error ?? 'That email already has an account. Log in instead.')
      }
      const { username } = await generateUniqueGamerTag()
      const res = await signup({ email, password, username, redirectTo: '/founding' })
      if (res?.error) return setError(res.error)
      if (res?.requiresEmailConfirmation) {
        setConfirming(true)
        setCooldown(30)
      } else {
        await syncClientSession()
        await onSignedIn()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepCard
      title={mode === 'signup' ? 'Sign Up' : 'Log In'}
      lead={mode === 'signup' ? 'Email and a password. Your store name comes in step 3.' : 'Welcome back. Log in to pick up where you left off.'}
    >
      <OAuthButtons next="/founding" tone="dark" dividerLabel="or use your email" className="mb-5" />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="f-email">
          <input id="f-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="f-password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          <input id="f-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT_CLS} placeholder="••••••••" />
        </Field>
        <FormError message={error} />
        <StepActions>
          <p className="text-body-sm text-text-tertiary">
            {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null) }}
              className={cn('font-medium text-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring')}
            >
              {mode === 'signup' ? 'Log In' : 'Sign Up'}
            </button>
          </p>
          <PrimaryButton busy={busy}>{mode === 'signup' ? 'Create Account' : 'Log In'}</PrimaryButton>
        </StepActions>
      </form>
    </StepCard>
  )
}
