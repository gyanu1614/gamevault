'use server'

/**
 * Post-OAuth required password. The ONLY path that writes it.
 *
 * Refuses, server-side, any account that already has a password (an `email`
 * identity or the stored `password_set` flag): this must never become a
 * "change password without the old one" endpoint. Password changes for
 * existing accounts stay on /account/settings (updatePassword) and the reset
 * link flow.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { rateLimitAction } from '@/lib/security/rate-limit'
import { needsPassword } from '@/lib/auth/oauth'

const MIN_LENGTH = 8

export async function setInitialPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limited = await rateLimitAction('auth')
  if (limited) return { ok: false, error: limited.error }

  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_LENGTH} characters.` }
  }
  if (password.length > 72) {
    return { ok: false, error: 'Use at most 72 characters.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Log in first.' }

  // Fail closed: the user object comes from the auth server (not the token),
  // so a stale JWT cannot sneak a second password-set through.
  if (!needsPassword(user)) {
    return { ok: false, error: 'This account already has a password. Change it from Account → Settings.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    console.error('[setInitialPassword] updateUser failed:', error.message)
    return { ok: false, error: 'That password was not accepted. Try a longer one.' }
  }

  // app_metadata is server-owned (service role only) — the stored flag the
  // middleware and client gate read. Stamped only after auth accepted it.
  const { error: flagError } = await createServiceRoleClient().auth.admin.updateUserById(user.id, {
    app_metadata: { password_set: true },
  })
  if (flagError) {
    // The password IS set; Supabase also adds the `email` provider, so the
    // gate still opens. Log and carry on.
    console.error('[setInitialPassword] password_set flag failed:', flagError.message)
  }

  return { ok: true }
}
