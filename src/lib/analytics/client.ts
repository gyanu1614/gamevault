/**
 * Browser analytics (growth point 1) — PostHog.
 *
 *   - Default (no choice, or Reject): `persistence: 'memory'`, nothing on the
 *     visitor's device. A visitor is one person per tab session until they
 *     sign in; `identify(user.id)` joins the rest.
 *   - Accept on the cookie bar (consent.ts): PostHog cookies, session replay
 *     with every input and `[data-ph-mask]` text masked, heatmaps.
 *   - Clicks on links, buttons and forms are autocaptured for everyone (no
 *     storage involved); input values are never sent.
 *   - Sent through `/ingest` (middleware proxy, our cookies stripped).
 *     Every event passes `sanitizeEventProperties` (URL params, uuids,
 *     personal keys) before it leaves the browser.
 *   - posthog-js is imported only when `startAnalytics()` runs (after the
 *     page is idle), so it never weighs on first load. Calls made before
 *     that are queued and replayed in order. No key → everything is a no-op.
 */
import { cleanEventProps, type AnalyticsEvent } from './events'
import { sanitizeEventProperties } from './sanitize'
import { INGEST_PATH } from './ingest-proxy'
import { readConsent, writeConsent, type AnalyticsConsent } from './consent'

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

/** True when PostHog will load here (key set, not a local dev host). */
export function analyticsEnabled(): boolean {
  return Boolean(key())
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
    const granted = readConsent() === 'granted'
    posthog.init(apiKey, {
      api_host: INGEST_PATH,
      ui_host: 'https://eu.posthog.com',
      ...consentConfig(granted),
      person_profiles: 'identified_only',
      // Clicks on interactive elements only; input values are never captured.
      autocapture: { dom_event_allowlist: ['click', 'submit'], element_allowlist: ['a', 'button', 'form', 'label', 'select'] },
      capture_pageview: 'history_change',
      capture_pageleave: true,
      disable_surveys: true,
      session_recording: { maskAllInputs: true, maskTextSelector: '[data-ph-mask]' },
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

/** What changes with consent: storage, replay, heatmaps and dead clicks. */
function consentConfig(granted: boolean) {
  return {
    persistence: granted ? ('localStorage+cookie' as const) : ('memory' as const),
    disable_session_recording: !granted,
    capture_heatmaps: granted,
    capture_dead_clicks: granted,
  }
}

/**
 * The cookie bar's answer. Accept switches the running instance to cookies
 * and starts replay without a reload; Reject keeps it cookieless and clears
 * anything PostHog may have stored.
 */
export function setAnalyticsConsent(value: AnalyticsConsent): void {
  writeConsent(value)
  run((ph) => {
    const granted = value === 'granted'
    ph.set_config(consentConfig(granted))
    if (granted) ph.startSessionRecording()
    else {
      ph.stopSessionRecording()
      try { ph.persistence?.clear() } catch { /* nothing stored */ }
    }
  })
}
