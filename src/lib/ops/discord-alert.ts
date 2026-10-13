/**
 * Post an operations alert to Discord (DISCORD_OPS_WEBHOOK_URL). Unset →
 * nothing is posted (the /admin cards still show the state). Never throws.
 */
export async function postOpsAlert(
  content: string,
  opts: { webhookUrl?: string | undefined; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const url = opts.webhookUrl ?? process.env.DISCORD_OPS_WEBHOOK_URL
  if (!url || !content) return false
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error(`[ops-alert] Discord webhook answered ${res.status}`)
    return res.ok
  } catch (e) {
    console.error('[ops-alert] Discord webhook failed:', (e as Error).message)
    return false
  }
}
