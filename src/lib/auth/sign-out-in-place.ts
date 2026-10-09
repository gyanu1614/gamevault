'use client'

/**
 * Sign out and stay on the current page (founding step 1's "Not you?", the
 * Set Your Password modal). The navbar's Log Out owns the "go home" path;
 * here the page itself re-renders logged-out: the browser client clears the
 * auth cookies, every useAuth() listener gets SIGNED_OUT, and the caller
 * refreshes whatever server state it holds.
 */
import { beginLogout } from '@/lib/auth/logout-signal'
import { createClient } from '@/lib/supabase/client'

export async function signOutInPlace(): Promise<void> {
  beginLogout()
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) console.error('[signOutInPlace]', error.message)
}
