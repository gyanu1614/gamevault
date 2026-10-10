import { SITE_URL } from '@/config/site'

import { alertMessage } from './daily'
import type { NewAlert } from './check'

/**
 * Post SEO alerts to Discord (DISCORD_SEO_WEBHOOK_URL). Unset → nothing is
 * posted and the alerts stay unposted on /admin/seo. Never throws.
 */
export async function postSeoAlerts(alerts: NewAlert[], opts: { webhookUrl?: string | undefined; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
  const url = opts.webhookUrl ?? process.env.DISCORD_SEO_WEBHOOK_URL
  if (!url || alerts.length === 0) return false
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: alertMessage(alerts, SITE_URL).slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error(`[seo-gsc] Discord webhook answered ${res.status}`)
    return res.ok
  } catch (e) {
    console.error('[seo-gsc] Discord webhook failed:', (e as Error).message)
    return false
  }
}
