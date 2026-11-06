/**
 * Chat email sender (one email per burst of chat messages).
 *
 * Called by pg_cron through pg_net (chat_email_kick, every minute, ONLY when
 * a batch is due; Vault secrets site_url + cron_secret) and once a day by the
 * vercel.json backstop. All the batching rules live in the database
 * (migration 20261102161137_chat_email_digest); the run is
 * lib/chat/email-digest.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ createServiceRoleClient }, { runChatEmailDigest }, { emailAllowedMany }, { sendTransactionalBatch }] =
    await Promise.all([
      import('@/lib/supabase/service'),
      import('@/lib/chat/email-digest'),
      import('@/lib/email/preferences'),
      import('@/lib/email'),
    ])
  const svc = createServiceRoleClient() as any

  try {
    const summary = await runChatEmailDigest({
      async claim(limit) {
        const { data, error } = await svc.rpc('chat_email_claim_due', { p_limit: limit })
        if (error) throw error
        return data ?? []
      },
      async complete(results) {
        const { error } = await svc.rpc('chat_email_complete', { p_results: results })
        if (error) throw error
      },
      allowed: (ids) => emailAllowedMany(ids, 'new_message'),
      sendBatch: sendTransactionalBatch,
    })
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[ChatEmailDigest] run failed:', err)
    return NextResponse.json({ error: 'run failed' }, { status: 500 })
  }
}
