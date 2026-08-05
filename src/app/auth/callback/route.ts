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
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { syncProfileEmail } from '@/lib/actions/auth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Supabase's default email links use the token-hash (verifyOtp) flow, NOT the
  // PKCE `?code=` flow — the confirmation URL arrives as
  // ?token_hash=…&type=signup. Handle both so email confirmation actually
  // establishes a session (otherwise the user lands signed-OUT and gets bounced
  // to /login by the destination's auth gate).
  const tokenHash = searchParams.get('token_hash')
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

  // ── Token-hash flow (Supabase default email confirmation links). Verifying
  //    the OTP establishes the session cookie, so the destination loads signed
  //    IN — this is what makes the confirmation link auto-sign-in and land the
  //    user straight in the seller application.
  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })
    if (!error) {
      if (isEmailChange) await syncProfileEmail().catch(() => {})
      return NextResponse.redirect(successUrl())
    }
    console.error('[AuthCallback] verifyOtp failed:', error.message)

    // Prefetch/double-click can consume the token before we do; if a session
    // already exists the confirmation actually succeeded — treat it as success.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      if (isEmailChange) await syncProfileEmail().catch(() => {})
      return NextResponse.redirect(successUrl())
    }
    return NextResponse.redirect(`${origin}/?auth_error=confirmation_failed`)
  }

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
