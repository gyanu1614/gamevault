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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow same-origin relative paths — never redirect off-site.
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[AuthCallback] Code exchange failed:', error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
