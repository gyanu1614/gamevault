import 'server-only'

/**
 * The ID check provider. Hosted flow: we create a session, the seller finishes it
 * on the provider's page, and the decision is read back with our API key. A webhook
 * body or a status in a URL is never the source of truth.
 */
import { normalizeDiditStatus } from '@/app/account/become-seller/_redesign/integrations'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { afterResponse } from '@/lib/after-response'
import { createNotification } from '@/lib/utils/notifications'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import type { IdentityCheckStatus } from './state'

const DIDIT_BASE = 'https://verification.didit.me/v3'

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export async function createDiditSession(userId: string): Promise<{ sessionId: string; url: string } | null> {
  const res = await fetch(`${DIDIT_BASE}/session/`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.DIDIT_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_id: process.env.DIDIT_WORKFLOW_ID,
      vendor_data: userId,
      callback: `${appBaseUrl()}/kyc/complete`,
      metadata: { purpose: 'seller_verification' },
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[identity-check] create session failed:', res.status)
    return null
  }
  const session = (await res.json()) as { session_id: string; url: string }
  return { sessionId: session.session_id, url: session.url }
}

/**
 * Reads the provider's current decision and records it. Throws when the provider
 * cannot be reached, so a webhook answers 500 and is retried.
 *
 * Returns the check's status, or null when the decision belongs to someone else.
 */
export async function syncIdentityCheck(sessionId: string, ownerId: string): Promise<IdentityCheckStatus | null> {
  const res = await fetch(`${DIDIT_BASE}/session/${sessionId}/decision/`, {
    headers: { 'x-api-key': process.env.DIDIT_API_KEY! },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`identity decision fetch failed: ${res.status}`)
  const decision = (await res.json()) as { status?: string; vendor_data?: string }

  if (decision.vendor_data !== ownerId) {
    console.error(`[identity-check] session ${sessionId} does not belong to its seller; ignored`)
    return null
  }

  const status = normalizeDiditStatus(decision.status)
  if (status === 'pending') return 'started'

  const service = createServiceRoleClient()
  const { data, error } = await (service.rpc as any)('identity_check_record', { p_session: sessionId, p_status: status })
  if (error) throw new Error(`identity_check_record: ${error.message}`)

  if (data?.newly_verified) {
    // The blue check is drawn on listing cards and store pages.
    await revalidateListingSurfaces(service as never, { sellerIds: [ownerId] })
    afterResponse('identity check verified notice', () =>
      createNotification({
        userId: ownerId,
        type: 'identity_verified',
        title: 'Identity Verified',
        message: 'You can now withdraw your balance.',
        link: '/account/wallet',
      }),
    )
  }
  return status
}
