import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { checkRateLimitByIp } from '@/lib/security/rate-limit'
import { parseValueEvent } from '@/lib/value-listings/events'

/**
 * Value page → listing funnel beacon (Bundle 2, task E). Accepts one event
 * from `navigator.sendBeacon` (text/plain JSON). Every field is validated to
 * an enum / slug / uuid (`parseValueEvent`), so nothing personal can be
 * stored; the IP is only used for the rate limit. Always 204 to the client —
 * a beacon has no reader — except 429 when over budget.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 1024

export async function POST(request: NextRequest) {
  const limited = await checkRateLimitByIp('valueEvent', request.headers)
  if (limited.limited) return new Response(null, { status: 429 })

  let body: unknown = null
  try {
    const text = await request.text()
    if (text.length <= MAX_BODY) body = JSON.parse(text)
  } catch {
    body = null
  }
  const row = parseValueEvent(body)
  if (!row) return new Response(null, { status: 204 })

  // value_funnel_events isn't in the generated types yet (regenerate after the migration lands).
  const { error } = await (createServiceRoleClient() as any).from('value_funnel_events').insert(row)
  if (error) console.error('[value-events] insert failed', error.message)
  return new Response(null, { status: 204 })
}
