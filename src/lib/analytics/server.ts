/**
 * Server-side PostHog events (growth point 1): the steps the browser can't
 * see reliably — payment confirmed by a provider webhook, a seller's first
 * sale. Same distinct id as the browser's `identify` (the Supabase user uuid),
 * so the server step joins the visitor's funnel.
 *
 * A plain fetch to the capture API (no SDK, no batching to flush), bounded by
 * a short timeout and never throwing: analytics must not slow or fail a
 * payment path. No key (tests, local, previews) → nothing is sent.
 */
import { cleanEventProps, type AnalyticsEvent } from './events'

const CAPTURE_URL = 'https://eu.i.posthog.com/i/v0/e/'
const TIMEOUT_MS = 1500

export async function captureServerEvent(input: {
  event: AnalyticsEvent
  distinctId: string
  props: Record<string, unknown>
}): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  // A local `next dev` server's test orders stay out of the data.
  if (!apiKey || process.env.NODE_ENV === 'development') return
  try {
    await fetch(CAPTURE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: input.event,
        distinct_id: input.distinctId,
        properties: { ...cleanEventProps(input.props), $lib: 'dropmarket-server' },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    console.warn('[analytics] server capture failed', e instanceof Error ? e.message : e)
  }
}
