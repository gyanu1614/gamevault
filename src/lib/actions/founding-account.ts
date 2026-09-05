'use server'

/**
 * One-step founding-seller account creation, from the HQ's "Set Up Your Store"
 * modal. The founder arrived via their magic link (HMAC token over their
 * waitlist row), which already PROVES they own the email — so we create the
 * account pre-confirmed (no confirmation email round-trip), sign them in, and
 * send them straight into the seller application.
 *
 * Security: the token is validated server-side against the waitlist row the
 * same way /founding itself resolves it (foundingTokenMatches). Without a valid
 * id+token pair this action refuses — a store name + password alone create
 * nothing.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { foundingTokenMatches } from '@/lib/founding/token'

export interface CreateFoundingAccountResult {
  success: boolean
  /** 'account_exists' → tell them to log in instead; anything else is shown verbatim. */
  error?: string
}

export async function createFoundingAccount(input: {
  id: string
  token: string
  storeName: string
  password: string
}): Promise<CreateFoundingAccountResult> {
  const storeName = (input.storeName || '').trim()
  const password = input.password || ''

  if (storeName.length < 3) return { success: false, error: 'Store name must be at least 3 characters.' }
  if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters.' }
  if (!input.id || !input.token) return { success: false, error: 'This page link is missing its invite token — reopen the magic link from your email.' }

  const svc = createServiceRoleClient() as any

  // 1. Resolve + verify the invite (same trust chain as the HQ page itself).
  const { data: row, error: rowErr } = await svc
    .from('early_seller_signups')
    .select('id, email')
    .eq('id', input.id)
    .maybeSingle()
  if (rowErr || !row) return { success: false, error: 'Invite not found — reopen the magic link from your email.' }
  if (!foundingTokenMatches(row.id, row.email, input.token)) {
    return { success: false, error: 'Invalid invite link — reopen the magic link from your email.' }
  }
  const email = (row.email as string).trim()

  // 2. An account may already exist for this email. A CONFIRMED one belongs to
  //    someone who can log in — refuse and point them at login. An UNCONFIRMED
  //    one is a stranded half-signup (e.g. they started the old email-confirm
  //    flow and never finished): the invite token proves this visitor owns the
  //    inbox, so take the account over — set their password, confirm the email,
  //    and continue as if freshly created.
  const { data: existing } = await svc
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  let userId: string | null = null
  if (existing?.id) {
    const { data: au } = await svc.auth.admin.getUserById(existing.id)
    if (au?.user && !au.user.email_confirmed_at) {
      const { error: updErr } = await svc.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...au.user.user_metadata, username: storeName, full_name: storeName },
      })
      if (updErr) {
        console.error('createFoundingAccount takeover failed:', updErr.message)
        return { success: false, error: 'Could not finish setting up your account. Please try again.' }
      }
      await svc.from('profiles').update({ username: storeName, full_name: storeName }).eq('id', existing.id)
      userId = existing.id
    } else {
      return { success: false, error: 'account_exists' }
    }
  } else {
    // 3. Create the account PRE-CONFIRMED — opening the magic link already
    //    verified the inbox, so no confirmation email is sent or needed.
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: storeName, full_name: storeName },
    })
    if (createErr || !created?.user) {
      console.error('createFoundingAccount admin.createUser failed:', createErr?.message)
      return { success: false, error: 'Could not create your account. Please try again.' }
    }
    userId = created.user.id
  }

  // 4. Tag the profile as a founding applicant (routing flag only — never the
  //    fee perk). The handle_new_user trigger has already created the row.
  await svc
    .from('profiles')
    .update({ is_founding_applicant: true })
    .eq('id', userId)

  // 5. Sign them in — the SSR client writes the session cookies.
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    // Account exists and is confirmed — login will still work manually.
    console.error('createFoundingAccount auto-login failed:', signInErr.message)
    return { success: false, error: 'Account created — please log in with your new password.' }
  }

  return { success: true }
}
