/**
 * /account/wallet — server shell.
 *
 * STATE-008 — this was the worst client-side auth→data waterfall in the app:
 * five useQuery calls, every one gated `enabled: !!user?.id && !authLoading`.
 * They fanned out in parallel with each other (correct), but the whole fan-out
 * sat behind a client auth round-trip, guaranteeing a two-hop cold start before
 * any wallet figure appeared — and an auth-shaped spinner while it happened.
 *
 * The route is middleware-protected, so the server already knows the user when
 * the request arrives. Resolving identity and seller status here lets the five
 * queries start on mount instead of after the session resolves, and lets the
 * island open on the correct tab on first paint rather than correcting it in a
 * useEffect after hydration.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WalletClient from './_WalletClient'

export default async function WalletPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent('/account/wallet')}`)
  }

  // Seller status decides the opening tab and whether the sales query runs.
  // Same signal use-auth resolves on the client: profiles.role === 'seller'.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <WalletClient
      userId={user.id}
      isSeller={(profile as { role?: string } | null)?.role === 'seller'}
    />
  )
}
