'use client'

/**
 * "Continue with Google" / "Continue with Discord".
 *
 * Starts the Supabase OAuth flow from the browser client (it owns the PKCE
 * verifier cookie) and returns through /auth/callback, which sends a new
 * account to Set Your Password before `next`. `next` is sanitized again
 * server-side; here it only decides where the user comes back to.
 *
 * Two tones: `light` for the ivory auth modal, `dark` for the site's black
 * surfaces (founding flow). Real brand marks, flat surfaces, no glow.
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { OAUTH_PROVIDERS, oauthCallbackUrl, type OAuthProvider } from '@/lib/auth/oauth'
import { cn } from '@/lib/utils'

const LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  discord: 'Continue with Discord',
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function DiscordMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 127.14 96.36" aria-hidden className={className}>
      <path
        fill="#5865F2"
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
      />
    </svg>
  )
}

const TONE = {
  light: {
    button:
      'border-[#E4E5DE] bg-white text-[#1A1D19] hover:bg-[#F6F7F2] focus-visible:ring-[#1B5E3A]/[0.18] disabled:opacity-60',
    line: 'bg-[#E4E5DE]',
    text: 'text-[#5B6157]',
    error: 'text-[#B91C1C]',
  },
  dark: {
    button:
      'border-border-default bg-bg-overlay text-text-primary hover:bg-bg-overlay-2 hover:border-border-strong focus-visible:ring-focus-ring disabled:opacity-50',
    line: 'bg-white/[0.10]',
    text: 'text-text-tertiary',
    error: 'text-error',
  },
} as const

export interface OAuthButtonsProps {
  /** Where to land after the round trip. Defaults to the current URL. */
  next?: string | null
  tone?: keyof typeof TONE
  /** Text on the divider under the buttons; pass null to drop the divider. */
  dividerLabel?: string | null
  className?: string
  /** Called with the provider before the browser leaves the page. */
  onStart?: (provider: OAuthProvider) => void
}

export function OAuthButtons({ next, tone = 'light', dividerLabel = 'or use your email', className, onStart }: OAuthButtonsProps) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const t = TONE[tone]

  async function start(provider: OAuthProvider) {
    if (busy) return
    setError(null)
    setBusy(provider)
    onStart?.(provider)
    const target = next ?? `${window.location.pathname}${window.location.search}`
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthCallbackUrl(window.location.origin, target) },
    })
    if (err) {
      setError(`Could not open ${provider === 'google' ? 'Google' : 'Discord'}. Try again in a moment.`)
      setBusy(null)
    }
    // On success the browser navigates away; leave the spinner on.
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-2.5">
        {OAUTH_PROVIDERS.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => start(provider)}
            disabled={busy !== null}
            aria-label={LABELS[provider]}
            aria-busy={busy === provider}
            className={cn(
              'relative flex h-11 w-full touch-manipulation items-center justify-center gap-3 rounded-xl border text-body-sm font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed',
              tone === 'dark' && 'rounded-md',
              t.button,
            )}
          >
            <span className="absolute left-4 flex h-5 w-5 items-center justify-center">
              {busy === provider ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : provider === 'google' ? (
                <GoogleMark className="h-[18px] w-[18px]" />
              ) : (
                <DiscordMark className="h-[18px] w-[18px]" />
              )}
            </span>
            <span>{LABELS[provider]}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className={cn('text-caption', t.error)}>
          {error}
        </p>
      )}
      {dividerLabel && (
        <div className="flex items-center gap-3" aria-hidden>
          <span className={cn('h-px flex-1', t.line)} />
          <span className={cn('text-caption', t.text)}>{dividerLabel}</span>
          <span className={cn('h-px flex-1', t.line)} />
        </div>
      )}
    </div>
  )
}
