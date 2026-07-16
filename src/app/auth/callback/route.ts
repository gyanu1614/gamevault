/**
 * Supabase auth code-exchange callback.
 *
 * Signup's emailRedirectTo (src/lib/actions/auth.ts) points here; without
 * this route every Supabase confirmation-email link 404s. Email confirmation
 * is currently OFF in the dashboard (signup auto-logs-in), but this route
 * must exist BEFORE anyone flips it on — and it also future-proofs magic
 * links / OAuth, which use the same PKCE code exchange.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncProfileEmail } from '@/lib/actions/auth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  // Only allow same-origin relative paths — never redirect off-site.
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  // Append the success signal AFTER the same-origin sanitizer so a crafted
  // `next` can't smuggle its own query string ahead of ours. Only signup
  // confirmations get ?confirmed=1 (magic-link/OAuth traffic stays silent).
  const successUrl = () => {
    if (type !== 'signup') return `${origin}${next}`
    const sep = next.includes('?') ? '&' : '?'
    return `${origin}${next}${sep}confirmed=1`
  }

  // Returning from a Change Email Address confirmation link — reconcile the
  // denormalized profiles.email mirror with the freshly-updated auth email.
  const isEmailChange = next.startsWith('/account/settings')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (isEmailChange) await syncProfileEmail().catch(() => {})
      return NextResponse.redirect(successUrl())
    }
    console.error('[AuthCallback] Code exchange failed:', error.message)

    // The code may already have been consumed — mail clients (Gmail/Outlook)
    // prefetch links, and users double-click. exchangeCodeForSession then
    // errors even though the session was already established. If getUser()
    // finds a user, the confirmation actually succeeded — treat it as such.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      if (isEmailChange) await syncProfileEmail().catch(() => {})
      return NextResponse.redirect(successUrl())
    }
    return NextResponse.redirect(`${origin}/?auth_error=confirmation_failed`)
  }

  // No `code` — Supabase forwards verify failures as ?error/?error_code
  // (e.g. otp_expired for an expired or already-used link).
  const errorCode = searchParams.get('error_code')
  if (errorCode) {
    console.error('[AuthCallback] Verify error:', errorCode, searchParams.get('error_description'))
    if (errorCode === 'otp_expired') {
      return NextResponse.redirect(`${origin}/?auth_error=link_expired`)
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=confirmation_failed`)
}
