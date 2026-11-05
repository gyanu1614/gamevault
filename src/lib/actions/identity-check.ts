'use server'

/**
 * Starting a seller's own ID check. Optional until they want to withdraw: nothing
 * here stops anyone listing or selling. Reading the state is a GET route
 * (lib/identity/status.ts) so it never queues behind other actions.
 */
import { isKycVideoEnabled } from '@/app/account/become-seller/_redesign/integrations'
import { createDiditSession } from '@/lib/identity/didit'
import { latestIdentityCheck } from '@/lib/identity/status'
import { rateLimitAction } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** An unfinished check can be picked up again for this long. */
const REUSE_MS = 60 * 60 * 1000

export async function startIdentityCheck(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const limited = await rateLimitAction('contact')
  if (limited) return { ok: false, error: limited.error ?? 'Too many tries. Wait a minute and try again.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }
  if (!isKycVideoEnabled()) return { ok: false, error: 'Identity checks are not open right now. Try again later.' }

  const service = createServiceRoleClient() as any
  const { data: profile } = await service.from('profiles').select('role, is_verified').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'seller') return { ok: false, error: 'Open your store first.' }
  if (profile.is_verified === true) return { ok: false, error: 'Your identity is already verified.' }

  const latest = await latestIdentityCheck(service, user.id)
  if (latest?.status === 'in_review') return { ok: false, error: 'Your check is being reviewed. We will let you know the result.' }
  if (latest?.status === 'started' && latest.session_url && Date.now() - new Date(latest.created_at).getTime() < REUSE_MS) {
    return { ok: true, url: latest.session_url }
  }

  try {
    const session = await createDiditSession(user.id)
    if (!session) return { ok: false, error: 'Could not start the check. Try again in a moment.' }
    const { error } = await service
      .from('identity_checks')
      .insert({ user_id: user.id, session_id: session.sessionId, session_url: session.url })
    if (error) throw new Error(error.message)
    return { ok: true, url: session.url }
  } catch (err) {
    console.error('[identity-check] start failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Could not start the check. Try again in a moment.' }
  }
}
