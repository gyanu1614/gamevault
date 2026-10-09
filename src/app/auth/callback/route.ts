/**
 * Supabase auth callback: email confirmation links (token_hash), the PKCE
 * `?code=` exchange (Google / Discord sign-in, magic links) and the error
 * redirects Supabase sends when a provider sign-in fails.
 *
 * OAuth (feat/oauth-signin): every account must have a password. A brand-new
 * Google/Discord account has none, so after the code exchange it is sent to
 * /auth/set-password (carrying `next`) instead of its destination. /founding
 * is exempt: its step 1 hosts the same panel. The rule itself lives in
 * src/lib/auth/oauth.ts and is shared with the middleware and client gate.
 * The Discord username is NOT copied anywhere: src/lib/auth/discord-handle.ts
 * reads it from the auth identity when the founding flow needs it.
 */

import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateUniqueGamerTag, syncProfileEmail } from '@/lib/actions/auth'
import { generateDiceBearAvatar } from '@/lib/utils/avatar'
import {
  isPasswordGateExempt,
  needsPassword,
  sanitizeNext,
  setPasswordUrl,
  type OAuthUserLike,
} from '@/lib/auth/oauth'

/** Append a query key to a same-origin path that may already carry a query. */
function withQuery(path: string, key: string, value: string) {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${key}=${value}`
}

/** Provider profile photos the trigger copies from OAuth metadata. */
const PROVIDER_PHOTO_HOSTS = /^https?:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|discordapp\.com|discord\.com)\//i

/**
 * A Google/Discord sign-up reaches the profile trigger with no `username` in
 * its metadata, so `handle_new_user` falls back to the email local-part — a
 * PUBLIC handle (profiles.username is anon-readable) that reconstructs the
 * address — and copies the provider's photo URL into avatar_url. A
 * local-part outside the 3–30 CHECK makes the trigger skip the row entirely.
 * All three are repaired here, service role, on every return: a fallback
 * username becomes a free gamer tag, a provider photo becomes the site
 * avatar (same DiceBear style every signup gets), a missing row is created.
 * Email signups always pass a username and never carry a provider photo, so
 * they never match. Non-critical — a failure never blocks the sign-in.
 */
async function ensureOAuthProfile(user: OAuthUserLike & { id: string; email?: string | null }) {
  const email = (user.email ?? '').trim().toLowerCase()
  if (!email) return
  const localPart = email.split('@')[0]
  try {
    const service = createServiceRoleClient()
    const { data: profile } = await service
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    const row = profile as { username?: string | null; avatar_url?: string | null } | null
    if (!row) {
      const { username } = await generateUniqueGamerTag()
      const { error } = await (service.from('profiles').insert as any)({
        id: user.id,
        username,
        email,
        avatar_url: generateDiceBearAvatar(username),
      })
      if (error) console.error('[AuthCallback] profile create failed:', error.message)
      return
    }
    const patch: { username?: string; avatar_url?: string } = {}
    let username = row.username ?? ''
    if (!username || username.toLowerCase() === localPart) {
      username = (await generateUniqueGamerTag()).username
      patch.username = username
    }
    if (patch.username || PROVIDER_PHOTO_HOSTS.test(row.avatar_url ?? '')) {
      patch.avatar_url = generateDiceBearAvatar(username)
    }
    if (Object.keys(patch).length === 0) return
    const { error } = await (service.from('profiles').update as any)(patch).eq('id', user.id)
    if (error) console.error('[AuthCallback] profile repair failed:', error.message)
  } catch (err) {
    console.error('[AuthCallback] ensureOAuthProfile failed:', (err as Error)?.message)
  }
}

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
  // Only same-origin relative paths, never an auth route — never off-site.
  const next = sanitizeNext(searchParams.get('next'))

  // Append the success signal AFTER the same-origin sanitizer so a crafted
  // `next` can't smuggle its own query string ahead of ours. Only signup
  // confirmations get ?confirmed=1 (magic-link/OAuth traffic stays silent).
  const successUrl = () => {
    if (type !== 'signup') return `${origin}${next}`
    return `${origin}${withQuery(next, 'confirmed', '1')}`
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    // The code may already have been consumed — mail clients (Gmail/Outlook)
    // prefetch links, and users double-click. exchangeCodeForSession then
    // errors even though the session was already established. If getUser()
    // finds a user, the sign-in actually succeeded — treat it as such.
    let user = data?.user ?? null
    if (error) {
      console.error('[AuthCallback] Code exchange failed:', error.message)
      user = (await supabase.auth.getUser()).data.user
      if (!user) return NextResponse.redirect(`${origin}/?auth_error=confirmation_failed`)
    }

    if (isEmailChange) await syncProfileEmail().catch(() => {})
    if (user) {
      await ensureOAuthProfile(user)
      // Required password: a fresh OAuth account goes to the set-password
      // screen first, then on to `next`. /founding keeps it inside step 1.
      if (needsPassword(user) && !isPasswordGateExempt(next)) {
        return NextResponse.redirect(`${origin}${setPasswordUrl(next)}`)
      }
    }
    return NextResponse.redirect(successUrl())
  }

  // No `code` — Supabase forwards failures as ?error/?error_code/
  // ?error_description (expired links, provider refusals).
  const errorCode = searchParams.get('error_code')
  const description = searchParams.get('error_description') ?? ''
  if (errorCode || searchParams.get('error')) {
    console.error('[AuthCallback] Verify error:', errorCode, description)
    if (errorCode === 'otp_expired') {
      return NextResponse.redirect(`${origin}/?auth_error=link_expired`)
    }
    // Provider sign-in refused by Supabase. The two cases a user can act on:
    // Discord shared an email it has not verified (Supabase will not link it
    // to an existing account), or the provider shared no email at all.
    if (/unverified email/i.test(description)) {
      return NextResponse.redirect(`${origin}${withQuery(next, 'auth_error', 'oauth_unverified_email')}`)
    }
    if (/user email from external provider/i.test(description)) {
      return NextResponse.redirect(`${origin}${withQuery(next, 'auth_error', 'oauth_no_email')}`)
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=confirmation_failed`)
}
