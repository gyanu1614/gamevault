/**
 * Analytics consent (2026-10-10). Everyone is measured cookieless, as before:
 * PostHog keeps its state in memory and stores nothing on the device. A
 * visitor who clicks Accept on the cookie bar upgrades to PostHog cookies
 * (one visitor across visits) and session replay with every input masked.
 *
 *   'granted'  → cookies + replay + heatmaps
 *   'denied'   → stays cookieless, no replay, bar never shows again
 *   null       → undecided: cookieless, bar shown
 *
 * Browsers that send Global Privacy Control are treated as 'denied' and never
 * see the bar. The choice itself is kept in localStorage under one key; that
 * record is strictly necessary (it is how we remember a "No").
 */
export type AnalyticsConsent = 'granted' | 'denied'

export const CONSENT_KEY = 'dm.analytics.consent'
/** Fired on window when the visitor reopens their choice (footer link). */
export const CONSENT_REOPEN_EVENT = 'dm:analytics-consent-reopen'

function store(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function hasGlobalPrivacyControl(): boolean {
  try {
    return typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  } catch {
    return false
  }
}

export function readConsent(): AnalyticsConsent | null {
  if (hasGlobalPrivacyControl()) return 'denied'
  try {
    const v = store()?.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function writeConsent(value: AnalyticsConsent | null): void {
  try {
    const s = store()
    if (!s) return
    if (value) s.setItem(CONSENT_KEY, value)
    else s.removeItem(CONSENT_KEY)
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}
