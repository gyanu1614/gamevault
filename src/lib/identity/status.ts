import 'server-only'

/**
 * A seller's own check, for the Settings card and the withdrawal page. Served by
 * GET /api/account/identity-check rather than a server action: it can call the
 * provider, and Next runs server actions one at a time, so a slow read here would
 * make every other click on the page wait.
 */
import { isKycVideoEnabled } from '@/app/account/become-seller/_redesign/integrations'
import { syncIdentityCheck } from '@/lib/identity/didit'
import { identityStateFrom, type IdentityCheckStatus, type IdentityState } from '@/lib/identity/state'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export type LatestIdentityCheck = {
  session_id: string
  session_url: string | null
  status: IdentityCheckStatus
  created_at: string
} | null

export async function latestIdentityCheck(service: any, userId: string): Promise<LatestIdentityCheck> {
  const { data } = await service
    .from('identity_checks')
    .select('session_id, session_url, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

export async function getIdentityCheckStatus(): Promise<{ state: IdentityState; available: boolean }> {
  const available = isKycVideoEnabled()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { state: 'not_started', available }

  const service = createServiceRoleClient() as any
  const { data: profile } = await service.from('profiles').select('is_verified').eq('id', user.id).maybeSingle()
  if (profile?.is_verified === true) return { state: 'verified', available }

  const latest = await latestIdentityCheck(service, user.id)
  let status = latest?.status ?? null
  // Back from the provider's page: read the result rather than wait for the webhook.
  if (latest && available && (status === 'started' || status === 'in_review')) {
    try {
      status = (await syncIdentityCheck(latest.session_id, user.id)) ?? status
    } catch (err) {
      console.error('[identity-check] status refresh failed:', err instanceof Error ? err.message : err)
    }
  }
  if (status === 'approved') return { state: 'verified', available }
  return { state: identityStateFrom(profile?.is_verified, status), available }
}
