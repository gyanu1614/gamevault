'use client'

/**
 * Set Your Password — the required step after a Google/Discord sign-in.
 *
 * A modal over whatever page the account landed on (homepage, founding,
 * a game hub), so the page stays in view and simply reappears when the
 * password is saved. It cannot be dismissed (no overlay click, no Escape,
 * no close button): the only ways out are saving a password or signing
 * out. Mounted by PasswordGate on every page and by /auth/set-password,
 * the server-side fallback the middleware sends protected routes to.
 */

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { setInitialPassword } from '@/lib/actions/set-password'
import { beginLogout } from '@/lib/auth/logout-signal'
import { logout } from '@/lib/actions/auth'
import { cn } from '@/lib/utils'

const MIN = 8

function providerName(provider: string | undefined) {
  if (provider === 'google') return 'Google'
  if (provider === 'discord') return 'Discord'
  return null
}

export interface SetPasswordDialogProps {
  open: boolean
  email: string | null | undefined
  /** `app_metadata.provider` of the account, for the one-line explanation. */
  provider?: string
  /** Called after the password is stored and the client session refreshed. */
  onSaved?: () => void
}

export function SetPasswordDialog({ open, email, provider, onSaved }: SetPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const via = providerName(provider)

  // Focus the one field on pointer devices; on a phone an autofocus throws
  // the keyboard over the explanation before it is read.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [open])

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
      // The refreshed token carries the stored flag; useAuth() sees the
      // TOKEN_REFRESHED event and the gate lets go on its own.
      await createClient().auth.refreshSession().catch(() => null)
      setPassword('')
      toast.success('Password Saved')
      onSaved?.()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" />
        <div className="fixed inset-0 z-[81] flex items-end justify-center p-3 sm:items-center sm:p-4">
          <Dialog.Content
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              'w-full max-w-[420px] rounded-lg border border-white/[0.10] bg-bg-raised p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] sm:p-7',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300',
            )}
          >
            <Dialog.Title className="text-balance text-heading text-text-primary">Set Your Password</Dialog.Title>
            <Dialog.Description className="mt-2 break-words text-body-sm leading-relaxed text-text-secondary">
              {via ? `You signed in with ${via}. ` : ''}
              Add a password so you can also log in with your email{email ? `, ${email}` : ''}.
            </Dialog.Description>

            <form onSubmit={submit} noValidate>
              <label htmlFor="sp-password" className="mt-6 block text-body-sm font-medium text-text-primary">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  ref={inputRef}
                  id="sp-password"
                  type={show ? 'text' : 'password'}
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

            <p className="mt-4 text-center text-caption text-text-tertiary">
              Not you?{' '}
              <button
                type="button"
                onClick={() => {
                  beginLogout()
                  logout().catch(() => undefined)
                }}
                className="font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Sign Out
              </button>
            </p>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
