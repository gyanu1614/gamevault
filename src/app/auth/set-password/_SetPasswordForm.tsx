'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { setInitialPassword } from '@/lib/actions/set-password'
import { needsPassword, sanitizeNext } from '@/lib/auth/oauth'
import { cn } from '@/lib/utils'
import { SetPasswordSkeleton } from './_shell'

const MIN = 8

function providerName(provider: string | undefined) {
  if (provider === 'google') return 'Google'
  if (provider === 'discord') return 'Discord'
  return null
}

export default function SetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = sanitizeNext(searchParams?.get('next'))
  const { user, loading } = useAuth()

  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Signed out → log in first (then come back here through the gate).
  // Already has a password → nothing to do here.
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(next)}`)
      return
    }
    if (!needsPassword(user)) router.replace(next)
  }, [loading, user, next, router])

  const ready = !loading && !!user && needsPassword(user)

  // Focus the one field on pointer devices only — on a phone an autofocus
  // throws the keyboard over the explanation before it is read.
  useEffect(() => {
    if (!ready) return
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus()
  }, [ready])

  if (!ready || !user) return <SetPasswordSkeleton />

  const via = providerName(user.app_metadata?.provider)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN) {
      setError(`Use at least ${MIN} characters.`)
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const res = await setInitialPassword(password)
      if (!res.ok) {
        setError(res.error)
        inputRef.current?.focus()
        return
      }
      // New token carries the stored flag, so the gates open at once.
      await createClient().auth.refreshSession().catch(() => null)
      toast.success('Password Saved')
      router.replace(next)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <h1 className="text-balance text-heading text-text-primary">Set Your Password</h1>
      <p className="mt-2 break-words text-body-sm leading-relaxed text-text-secondary">
        {via ? `You signed in with ${via}. ` : ''}
        Add a password so you can also log in with your email, {user.email}.
      </p>

      <label htmlFor="sp-password" className="mt-7 block text-body-sm font-medium text-text-primary">
        Password
      </label>
      <div className="relative mt-1.5">
        <input
          id="sp-password"
          type={show ? 'text' : 'password'}
          ref={inputRef}
          autoComplete="new-password"
          required
          minLength={MIN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="sp-hint"
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full rounded-md border border-border-default bg-bg-overlay pl-3.5 pr-12 text-[16px] text-text-primary placeholder:text-text-tertiary transition-colors',
            'hover:border-border-strong focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:text-body-sm',
          )}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 touch-manipulation items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <p id="sp-hint" className="mt-1.5 text-caption text-text-tertiary">
        At least {MIN} characters. You can change it later in Account → Settings.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-body-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 inline-flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-md bg-white text-body-sm font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Save Password
      </button>
    </form>
  )
}
