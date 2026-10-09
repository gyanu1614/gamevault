/**
 * Browser analytics (growth point 1) — PostHog, cookieless.
 *
 *   - `persistence: 'memory'`: nothing on the visitor's device (no cookie,
 *     no localStorage), so the Cookie Policy's "no analytics cookies" holds
 *     and no consent banner is needed. A visitor is one person per tab
 *     session until they sign in; `identify(user.id)` joins the rest.
 *   - Sent through `/ingest` (middleware proxy, our cookies stripped).
 *   - No autocapture, no session replay, no surveys; page views on route
 *     change. Every event passes `sanitizeEventProperties` (URL params,
 *     uuids, personal keys) before it leaves the browser.
 *   - posthog-js is imported only when `startAnalytics()` runs (after the
 *     page is idle), so it never weighs on first load. Calls made before
 *     that are queued and replayed in order. No key → everything is a no-op.
 */
import { cleanEventProps, type AnalyticsEvent } from './events'
import { sanitizeEventProperties } from './sanitize'
import { INGEST_PATH } from './ingest-proxy'

type PostHog = typeof import('posthog-js').default
type Call = (ph: PostHog) => void

let instance: PostHog | null = null
let loading: Promise<void> | null = null
const queue: Call[] = []

/** Dev and test visits (localhost, *.localhost) never reach PostHog. */
function isLocalHost(): boolean {
  if (typeof location === 'undefined') return false
  const h = location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')
}

function key(): string | undefined {
  if (isLocalHost()) return undefined
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || undefined
}

function run(call: Call) {
  if (!key()) return
  if (instance) call(instance)
  else if (queue.length < 100) queue.push(call)
}

export function startAnalytics(): Promise<void> {
  const apiKey = key()
  if (!apiKey) return Promise.resolve()
  loading ??= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(apiKey, {
      api_host: INGEST_PATH,
      ui_host: 'https://eu.posthog.com',
      persistence: 'memory',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: 'history_change',
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      // Dead-click and heatmap capture record clicked elements / positions:
      // off, like autocapture, whatever the project settings say. Web vitals
      // stay (page speed numbers, no personal data).
      capture_dead_clicks: false,
      capture_heatmaps: false,
      mask_personal_data_properties: true,
      before_send: (event) => {
        if (event?.properties) event.properties = sanitizeEventProperties(event.properties)
        if (event?.$set) event.$set = sanitizeEventProperties(event.$set)
        if (event?.$set_once) event.$set_once = sanitizeEventProperties(event.$set_once)
        return event
      },
    })
    instance = posthog
    for (const call of queue.splice(0)) call(posthog)
  }).catch((e) => {
    console.warn('[analytics] PostHog failed to load', e instanceof Error ? e.message : e)
  })
  return loading
}

/**
 * `beacon`: for a step followed by a full-page redirect (checkout → payment
 * page), so the request survives the unload.
 */
export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}, opts: { beacon?: boolean } = {}): void {
  const clean = cleanEventProps(props)
  run((ph) => {
    if (opts.beacon) ph.capture(event, clean, { transport: 'sendBeacon' })
    else ph.capture(event, clean)
  })
}

/** Internal Supabase user id only — never an email or name. */
export function identify(userId: string): void {
  run((ph) => { ph.identify(userId) })
}

export function reset(): void {
  run((ph) => { ph.reset() })
}
